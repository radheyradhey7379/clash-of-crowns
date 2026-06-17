import { useState, useEffect, useCallback } from 'react';
import { VersionGateStatus, VersionGateDecision, VersionGateConfig } from './versionGateTypes';
import { checkVersionGate } from './versionGateService';
import { setRemoteVersionConfig } from '../config/featureAvailability';

export function useVersionGate() {
  const [status, setStatus] = useState<VersionGateStatus>('checking');
  const [decision, setDecision] = useState<VersionGateDecision | null>(null);
  const [config, setConfig] = useState<VersionGateConfig | null>(null);

  const runCheck = useCallback(async () => {
    setStatus('checking');
    
    const result = await checkVersionGate();
    
    setConfig(result.config);
    setDecision(result.decision);
    
    // Register the remote config so the rest of the app can use it for feature resolution
    setRemoteVersionConfig(result.config);

    // Map decision to status
    if (result.decision === 'config_error_fallback') {
      setStatus('fallback_allowed');
    } else {
      setStatus(result.decision as VersionGateStatus);
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const dismissSoftUpdate = useCallback(() => {
    if (status === 'soft_update') {
      setStatus('allowed');
    }
  }, [status]);

  return {
    status,
    decision,
    config,
    retry: runCheck,
    dismissSoftUpdate
  };
}
