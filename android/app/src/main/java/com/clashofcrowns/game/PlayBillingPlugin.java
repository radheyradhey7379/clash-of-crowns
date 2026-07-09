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
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "BillingClient connection established successfully.");
                    isClientReady = true;
                } else {
                    Log.w(TAG, "BillingClient setup failed with response code: " + billingResult.getResponseCode());
                    isClientReady = false;
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "BillingClient disconnected. Reconnecting...");
                isClientReady = false;
                // Reconnection logic
                getBridge().executeOnMainThread(() -> connectToGooglePlay());
            }
        });
    }

    private void ensureBillingClientConnection(Runnable onConnected, Runnable onError) {
        if (isClientReady && billingClient != null) {
            onConnected.run();
            return;
        }

        if (billingClient == null) {
            initBillingClient();
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
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
    }

    @PluginMethod
    public void loadProducts(PluginCall call) {
        JSArray productIdsArray = call.getArray("productIds");
        if (productIdsArray == null) {
            call.reject("Missing productIds argument");
            return;
        }

        ensureBillingClientConnection(() -> {
            List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
            try {
                List<String> ids = productIdsArray.toList();
                for (String id : ids) {
                    // Determine if it is subscription or in-app
                    String type = id.contains("monthly") ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP;
                    productList.add(
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(id)
                            .setProductType(type)
                            .build()
                    );
                }
            } catch (Exception e) {
                call.reject("Failed to parse productIds: " + e.getMessage());
                return;
            }

            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

            billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    JSArray resultArr = new JSArray();
                    List<ProductDetails> productDetailsList = productDetailsResult.getProductDetailsList();
                    if (productDetailsList != null) {
                        for (ProductDetails details : productDetailsList) {
                            JSObject obj = new JSObject();
                        obj.put("productId", details.getProductId());
                        obj.put("title", details.getTitle());
                        obj.put("description", details.getDescription());
                        obj.put("type", details.getProductType());

                        // Get formatted pricing details
                        if (details.getProductType().equals(BillingClient.ProductType.INAPP)) {
                            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
                            if (offer != null) {
                                obj.put("price", offer.getFormattedPrice());
                            }
                        } else {
                            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                            if (offers != null && !offers.isEmpty()) {
                                ProductDetails.SubscriptionOfferDetails firstOffer = offers.get(0);
                                List<ProductDetails.PricingPhase> phases = firstOffer.getPricingPhases().getPricingPhaseList();
                                if (!phases.isEmpty()) {
                                    obj.put("price", phases.get(0).getFormattedPrice());
                                }
                            }
                        }
                        resultArr.put(obj);
                        }
                    }
                    JSObject response = new JSObject();
                    response.put("products", resultArr);
                    call.resolve(response);
                } else {
                    call.reject("Failed to query products from Google Play: " + billingResult.getDebugMessage());
                }
            });
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
            String productType = productId.contains("monthly") ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP;
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

            billingClient.queryProductDetailsAsync(detailsParams, (billingResult, productDetailsResult) -> {
                List<ProductDetails> productDetailsList = productDetailsResult.getProductDetailsList();
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList == null || productDetailsList.isEmpty()) {
                    call.reject("Product details not found for: " + productId);
                    return;
                }

                ProductDetails details = productDetailsList.get(0);
                List<BillingFlowParams.ProductDetailsParams> flowProductParams = new ArrayList<>();
                BillingFlowParams.ProductDetailsParams.Builder flowBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details);

                if (productType.equals(BillingClient.ProductType.SUBS)) {
                    List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                    if (offers != null && !offers.isEmpty()) {
                        flowBuilder.setOfferToken(offers.get(0).getOfferToken());
                    }
                }

                flowProductParams.add(flowBuilder.build());

                BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(flowProductParams)
                    .build();

                getBridge().executeOnMainThread(() -> {
                    Activity activity = getActivity();
                    if (activity != null) {
                        synchronized (pendingPurchaseCalls) {
                            pendingPurchaseCalls.add(call);
                        }
                        billingClient.launchBillingFlow(activity, flowParams);
                    } else {
                        call.reject("App activity is currently unavailable");
                    }
                });
            });
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
                billingClient.queryPurchasesAsync(params, (billingResult, purchasesList) -> {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        for (Purchase purchase : purchasesList) {
                            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                for (String pId : purchase.getProducts()) {
                                    JSObject obj = new JSObject();
                                    obj.put("productId", pId);
                                    obj.put("purchaseToken", purchase.getPurchaseToken());
                                    obj.put("orderId", purchase.getOrderId());
                                    purchasesArr.put(obj);
                                }
                            }
                        }
                    }

                    synchronized (pendingQueries) {
                        pendingQueries[0]--;
                        if (pendingQueries[0] == 0) {
                            JSObject response = new JSObject();
                            response.put("purchases", purchasesArr);
                            call.resolve(response);
                        }
                    }
                });
            }
        }, () -> call.reject("Google Play Billing client not connected"));
    }

    private void handlePurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        List<PluginCall> callsToResolve;
        synchronized (pendingPurchaseCalls) {
            callsToResolve = new ArrayList<>(pendingPurchaseCalls);
            pendingPurchaseCalls.clear();
        }

        int responseCode = billingResult.getResponseCode();
        for (PluginCall call : callsToResolve) {
            if (responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
                for (Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        JSObject obj = new JSObject();
                        obj.put("status", "success");
                        obj.put("productId", purchase.getProducts().get(0));
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
        }
    }
}
