package com.clashofcrowns.game;

import android.app.Activity;
import android.util.Log;
import androidx.annotation.NonNull;
import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin {
    private static final String TAG = "PlayBillingPlugin";
    private BillingClient billingClient;
    private boolean isClientReady = false;
    private final List<PluginCall> pendingPurchaseCalls = new ArrayList<>();

    @Override
    public void load() {
        super.load();
        initBillingClient();
    }

    private synchronized void initBillingClient() {
        if (billingClient != null) return;

        billingClient = BillingClient.newBuilder(getContext())
            .setListener(new PurchasesUpdatedListener() {
                @Override
                public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
                    handlePurchasesUpdated(billingResult, purchases);
                }
            })
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();

        connectToGooglePlay();
    }

    private void connectToGooglePlay() {
        try {
            billingClient.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                    if (billingResult != null && billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        Log.d(TAG, "BillingClient connection established successfully.");
                        isClientReady = true;
                    } else {
                        Log.w(TAG, "BillingClient setup failed.");
                        isClientReady = false;
                    }
                }

                @Override
                public void onBillingServiceDisconnected() {
                    Log.w(TAG, "BillingClient disconnected. Reconnecting...");
                    isClientReady = false;
                    try {
                        getBridge().executeOnMainThread(() -> connectToGooglePlay());
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to schedule reconnection on main thread", e);
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to start BillingClient connection", e);
        }
    }

    private void ensureBillingClientConnection(Runnable onConnected, Runnable onError) {
        if (isClientReady && billingClient != null) {
            onConnected.run();
            return;
        }

        if (billingClient == null) {
            initBillingClient();
        }

        try {
            billingClient.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                    if (billingResult != null && billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        isClientReady = true;
                        onConnected.run();
                    } else {
                        isClientReady = false;
                        onError.run();
                    }
                }

                @Override
                public void onBillingServiceDisconnected() {
                    isClientReady = false;
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to establish connection inside ensureBillingClientConnection", e);
            onError.run();
        }
    }

    private String getProductType(String productId) {
        if (productId.equals("premium_analysis_monthly") || productId.equals("premium_undo_addon_monthly")) {
            return BillingClient.ProductType.SUBS;
        }
        return BillingClient.ProductType.INAPP;
    }

    @PluginMethod
    public void loadProducts(PluginCall call) {
        JSArray productIdsArray = call.getArray("productIds");
        if (productIdsArray == null) {
            call.reject("Missing productIds argument");
            return;
        }

        ensureBillingClientConnection(() -> {
            List<QueryProductDetailsParams.Product> subsList = new ArrayList<>();
            List<QueryProductDetailsParams.Product> inappList = new ArrayList<>();
            
            try {
                for (int i = 0; i < productIdsArray.length(); i++) {
                    String id = productIdsArray.getString(i);
                    if (id != null) {
                        String type = getProductType(id);
                        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(id)
                            .setProductType(type)
                            .build();
                        
                        if (type.equals(BillingClient.ProductType.SUBS)) {
                            subsList.add(product);
                        } else {
                            inappList.add(product);
                        }
                    }
                }
            } catch (Exception e) {
                call.reject("Failed to parse productIds: " + e.getMessage());
                return;
            }

            final JSArray combinedArr = new JSArray();
            final int[] pendingQueries = { 0 };
            if (!subsList.isEmpty()) pendingQueries[0]++;
            if (!inappList.isEmpty()) pendingQueries[0]++;

            if (pendingQueries[0] == 0) {
                JSObject response = new JSObject();
                response.put("products", combinedArr);
                call.resolve(response);
                return;
            }

            Runnable checkCompletion = () -> {
                synchronized (pendingQueries) {
                    pendingQueries[0]--;
                    if (pendingQueries[0] <= 0) {
                        JSObject response = new JSObject();
                        response.put("products", combinedArr);
                        call.resolve(response);
                    }
                }
            };

            // Query SUBS (Google Play Billing does not support mixing INAPP and SUBS in setProductList)
            if (!subsList.isEmpty()) {
                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(subsList)
                    .build();
                try {
                    billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
                        try {
                            if (billingResult != null && billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && productDetailsResult != null) {
                                List<ProductDetails> detailsList = productDetailsResult.getProductDetailsList();
                                if (detailsList != null) {
                                    for (ProductDetails details : detailsList) {
                                        if (details != null) {
                                            JSObject obj = new JSObject();
                                            obj.put("productId", details.getProductId());
                                            obj.put("title", details.getTitle());
                                            obj.put("description", details.getDescription());
                                            obj.put("type", details.getProductType());

                                            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                                            if (offers != null && !offers.isEmpty()) {
                                                ProductDetails.SubscriptionOfferDetails firstOffer = offers.get(0);
                                                if (firstOffer != null && firstOffer.getPricingPhases() != null) {
                                                    List<ProductDetails.PricingPhase> phases = firstOffer.getPricingPhases().getPricingPhaseList();
                                                    if (phases != null && !phases.isEmpty()) {
                                                        obj.put("price", phases.get(0).getFormattedPrice());
                                                    }
                                                }
                                            }
                                            synchronized (combinedArr) {
                                                combinedArr.put(obj);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error parsing SUBS product details callback", e);
                        } finally {
                            checkCompletion.run();
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error initiating SUBS queryProductDetailsAsync", e);
                    checkCompletion.run();
                }
            }

            // Query INAPP
            if (!inappList.isEmpty()) {
                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(inappList)
                    .build();
                try {
                    billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
                        try {
                            if (billingResult != null && billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && productDetailsResult != null) {
                                List<ProductDetails> detailsList = productDetailsResult.getProductDetailsList();
                                if (detailsList != null) {
                                    for (ProductDetails details : detailsList) {
                                        if (details != null) {
                                            JSObject obj = new JSObject();
                                            obj.put("productId", details.getProductId());
                                            obj.put("title", details.getTitle());
                                            obj.put("description", details.getDescription());
                                            obj.put("type", details.getProductType());

                                            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
                                            if (offer != null) {
                                                obj.put("price", offer.getFormattedPrice());
                                            }
                                            synchronized (combinedArr) {
                                                combinedArr.put(obj);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error parsing INAPP product details callback", e);
                        } finally {
                            checkCompletion.run();
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error initiating INAPP queryProductDetailsAsync", e);
                    checkCompletion.run();
                }
            }

        }, () -> call.reject("Google Play Billing client not connected"));
    }

    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("Missing productId argument");
            return;
        }

        ensureBillingClientConnection(() -> {
            String productType = getProductType(productId);
            List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
            productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(productType)
                    .build()
            );

            QueryProductDetailsParams detailsParams = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

            try {
                billingClient.queryProductDetailsAsync(detailsParams, (billingResult, productDetailsResult) -> {
                    try {
                        if (billingResult == null) {
                            call.reject("Billing result is null");
                            return;
                        }
                        
                        List<ProductDetails> productDetailsList = null;
                        if (productDetailsResult != null) {
                            productDetailsList = productDetailsResult.getProductDetailsList();
                        }
                        
                        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList == null || productDetailsList.isEmpty()) {
                            call.reject("Product details not found for: " + productId);
                            return;
                        }

                        ProductDetails details = productDetailsList.get(0);
                        if (details == null) {
                            call.reject("Product details item is null");
                            return;
                        }
                        
                        List<BillingFlowParams.ProductDetailsParams> flowProductParams = new ArrayList<>();
                        BillingFlowParams.ProductDetailsParams.Builder flowBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(details);

                        if (productType.equals(BillingClient.ProductType.SUBS)) {
                            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                            if (offers != null && !offers.isEmpty() && offers.get(0) != null) {
                                flowBuilder.setOfferToken(offers.get(0).getOfferToken());
                            }
                        }

                        flowProductParams.add(flowBuilder.build());

                        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                            .setProductDetailsParamsList(flowProductParams)
                            .build();

                        getBridge().executeOnMainThread(() -> {
                            try {
                                Activity activity = getActivity();
                                if (activity != null) {
                                    synchronized (pendingPurchaseCalls) {
                                        pendingPurchaseCalls.add(call);
                                    }
                                    billingClient.launchBillingFlow(activity, flowParams);
                                } else {
                                    call.reject("App activity is currently unavailable");
                                }
                            } catch (Exception e) {
                                Log.e(TAG, "Error launching billing flow on main thread", e);
                                call.reject("Failed to launch billing UI: " + e.getMessage());
                            }
                        });
                    } catch (Exception e) {
                        Log.e(TAG, "Error in purchaseProduct query callback", e);
                        call.reject("Internal error in purchase initiation: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error initiating purchase query", e);
                call.reject("Failed to initiate purchase: " + e.getMessage());
            }
        }, () -> call.reject("Google Play Billing client not connected"));
    }

    @PluginMethod
    public void restoreActivePurchases(PluginCall call) {
        ensureBillingClientConnection(() -> {
            List<QueryPurchasesParams> paramsList = new ArrayList<>();
            paramsList.add(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build());
            paramsList.add(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build());

            final JSArray purchasesArr = new JSArray();
            final int[] pendingQueries = { 2 };

            for (QueryPurchasesParams params : paramsList) {
                try {
                    billingClient.queryPurchasesAsync(params, (billingResult, purchasesList) -> {
                        try {
                            if (billingResult == null) {
                                return;
                            }
                            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchasesList != null) {
                                for (Purchase purchase : purchasesList) {
                                    if (purchase != null && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                        List<String> products = purchase.getProducts();
                                        if (products != null) {
                                            for (String pId : products) {
                                                JSObject obj = new JSObject();
                                                obj.put("productId", pId);
                                                obj.put("purchaseToken", purchase.getPurchaseToken());
                                                obj.put("orderId", purchase.getOrderId());
                                                purchasesArr.put(obj);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error processing queryPurchases callback", e);
                        } finally {
                            synchronized (pendingQueries) {
                                pendingQueries[0]--;
                                if (pendingQueries[0] == 0) {
                                    JSObject response = new JSObject();
                                    response.put("purchases", purchasesArr);
                                    call.resolve(response);
                                }
                            }
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error initiating queryPurchasesAsync", e);
                    synchronized (pendingQueries) {
                        pendingQueries[0]--;
                        if (pendingQueries[0] == 0) {
                            JSObject response = new JSObject();
                            response.put("purchases", purchasesArr);
                            call.resolve(response);
                        }
                    }
                }
            }
        }, () -> call.reject("Google Play Billing client not connected"));
    }

    private void handlePurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        List<PluginCall> callsToResolve;
        synchronized (pendingPurchaseCalls) {
            callsToResolve = new ArrayList<>(pendingPurchaseCalls);
            pendingPurchaseCalls.clear();
        }

        if (billingResult == null) {
            for (PluginCall call : callsToResolve) {
                call.reject("Purchase result is null");
            }
            return;
        }

        int responseCode = billingResult.getResponseCode();
        for (PluginCall call : callsToResolve) {
            try {
                if (responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase purchase : purchases) {
                        if (purchase != null && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                            JSObject obj = new JSObject();
                            obj.put("status", "success");
                            List<String> products = purchase.getProducts();
                            obj.put("productId", (products != null && !products.isEmpty()) ? products.get(0) : "");
                            obj.put("purchaseToken", purchase.getPurchaseToken());
                            obj.put("orderId", purchase.getOrderId());
                            call.resolve(obj);
                            return;
                        }
                    }
                    call.reject("Purchase completed but status is not purchased yet.");
                } else if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
                    JSObject obj = new JSObject();
                    obj.put("status", "canceled");
                    obj.put("message", "Purchase cancelled.");
                    call.resolve(obj);
                } else {
                    JSObject obj = new JSObject();
                    obj.put("status", "error");
                    obj.put("message", "Purchase failed: " + billingResult.getDebugMessage());
                    call.resolve(obj);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in handlePurchasesUpdated callback logic", e);
                call.reject("Purchase processing failed: " + e.getMessage());
            }
        }
    }
}
