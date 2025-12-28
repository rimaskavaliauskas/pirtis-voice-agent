'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  exportBrainConfig,
  validateBrainConfig,
  importBrainConfig,
  setAdminKey,
  clearAdminKey,
} from '@/lib/api';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

type AdminState = 'not_authenticated' | 'authenticated' | 'loading';

// ============================================
// Component
// ============================================

export default function AdminPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<AdminState>('loading');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const [yamlContent, setYamlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Check if already authenticated
  useEffect(() => {
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('admin_key') : null;
    if (storedKey) {
      setAuthState('authenticated');
    } else {
      setAuthState('not_authenticated');
      setShowAuthDialog(true);
    }
  }, []);

  // Handle authentication
  const handleAuthenticate = useCallback(() => {
    if (!adminKeyInput.trim()) {
      toast.error('Please enter an admin key');
      return;
    }

    setAdminKey(adminKeyInput.trim());
    setAuthState('authenticated');
    setShowAuthDialog(false);
    toast.success('Authenticated successfully');
  }, [adminKeyInput]);

  // Handle logout
  const handleLogout = useCallback(() => {
    clearAdminKey();
    setAuthState('not_authenticated');
    setYamlContent('');
    setShowAuthDialog(true);
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsLoading(true);
    setValidationErrors([]);

    try {
      const response = await exportBrainConfig();
      setYamlContent(response.yaml);
      toast.success('Configuration exported');
    } catch (error) {
      console.error('Export failed:', error);

      // Demo mode: show sample YAML
      const sampleYaml = `# Brain Configuration - Pirtis Interview Agent
# This YAML file defines the agent's behavior

scoring:
  weights:
    base_priority: 1.0
    missing_slot: 2.0
    risk: 1.5
    round_fit: 0.5
    asked_penalty: -10.0
    required_slot_bonus: 1.0

slots:
  - key: purpose
    label: "Pirties paskirtis"
    type: string
    is_required: true
    examples: ["family", "commercial", "spa", "training"]

  - key: users
    label: "Naudotojai"
    type: object
    is_required: true

  - key: ritual
    label: "Ritualas"
    type: string
    is_required: false
    examples: ["vantojimas", "gulėjimas", "SPA"]

  - key: location
    label: "Vieta"
    type: string
    is_required: true
    examples: ["separate", "in_house", "mobile"]

  - key: infrastructure
    label: "Infrastruktūra"
    type: object
    is_required: true

  - key: stove_type
    label: "Krosnies tipas"
    type: string
    is_required: false
    examples: ["periodic", "continuous"]

questions:
  - id: Q_R1_PURPOSE
    text: "Papasakokite apie planuojamą pirties naudojimą. Ar tai šeimai, komerciniam naudojimui, ar specialioms procedūroms?"
    slot_coverage: [purpose]
    risk_coverage: []
    round_fit: [1]
    base_priority: 10
    enabled: true

  - id: Q_R1_USERS
    text: "Kas naudosis pirtimi? Kiek žmonių, ar bus vaikų, pagyvenusių ar turinčių specialių poreikių?"
    slot_coverage: [users]
    risk_coverage: []
    round_fit: [1]
    base_priority: 9
    enabled: true

  - id: Q_R1_RITUAL
    text: "Kokie pirties ritualai jums svarbūs? Ar naudojate vantas, mėgstate gulėti, ar norite SPA elementų?"
    slot_coverage: [ritual]
    risk_coverage: []
    round_fit: [1]
    base_priority: 8
    enabled: true

risk_rules:
  - code: RISK_SOFT_STEAM_CONFLICT
    description: "Conflict between desired soft steam and continuous stove"
    severity: medium
    rule_json:
      all:
        - slot: ritual
          contains_any: ["minkštas garas", "soft steam"]
        - slot: stove_type
          eq_any: ["continuous"]

  - code: RISK_WINTER_NO_WATER
    description: "Winter use without water infrastructure"
    severity: high
    rule_json:
      all:
        - slot: infrastructure
          not_contains_any: ["water"]
        - slot: usage_season
          contains_any: ["winter", "year_round"]
`;
      setYamlContent(sampleYaml);
      toast.info('Showing sample configuration (backend not connected)');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle validate
  const handleValidate = useCallback(async () => {
    if (!yamlContent.trim()) {
      toast.error('No configuration to validate');
      return;
    }

    setIsLoading(true);
    setValidationErrors([]);

    try {
      const response = await validateBrainConfig({ yaml: yamlContent });

      if (response.valid) {
        toast.success('Configuration is valid');
      } else {
        setValidationErrors(response.errors || ['Unknown validation error']);
        toast.error('Configuration has errors');
      }
    } catch (error) {
      console.error('Validation failed:', error);

      // Demo mode: basic YAML validation
      try {
        // Simple check for YAML structure
        if (yamlContent.includes('scoring:') && yamlContent.includes('slots:')) {
          toast.success('Basic structure looks valid (backend not connected)');
        } else {
          setValidationErrors(['Missing required sections: scoring, slots']);
          toast.error('Configuration has errors');
        }
      } catch {
        toast.error('Failed to validate configuration');
      }
    } finally {
      setIsLoading(false);
    }
  }, [yamlContent]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!yamlContent.trim()) {
      toast.error('No configuration to import');
      return;
    }

    setIsLoading(true);

    try {
      const response = await importBrainConfig({ yaml: yamlContent });
      toast.success(response.message || 'Configuration imported successfully');
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import configuration (backend not connected)');
    } finally {
      setIsLoading(false);
    }
  }, [yamlContent]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!yamlContent.trim()) {
      toast.error('No configuration to download');
      return;
    }

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brain_config.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Configuration downloaded');
  }, [yamlContent]);

  // Auth dialog
  if (authState === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner className="w-10 h-10" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Authentication</DialogTitle>
            <DialogDescription>
              Enter your admin key to access the configuration panel.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              type="password"
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              placeholder="Enter admin key..."
              className="w-full px-3 py-2 border rounded-md"
              onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push('/')}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate}>Authenticate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      {authState === 'authenticated' && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Brain Configuration</h1>
              <p className="text-muted-foreground">
                Edit and manage the agent&apos;s question bank, slots, and rules
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExport} disabled={isLoading}>
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export from DB
                </Button>
                <Button onClick={handleValidate} disabled={isLoading} variant="outline">
                  <CheckIcon className="w-4 h-4 mr-2" />
                  Validate
                </Button>
                <Button onClick={handleImport} disabled={isLoading} variant="outline">
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Import to DB
                </Button>
                <Button onClick={handleDownload} disabled={isLoading} variant="ghost">
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Download YAML
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-destructive text-lg">
                  Validation Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {validationErrors.map((err, i) => (
                    <li key={i} className="text-destructive">
                      {err}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* YAML Editor */}
          <Card>
            <CardHeader>
              <CardTitle>YAML Configuration</CardTitle>
              <CardDescription>
                Edit the agent&apos;s brain configuration. Changes take effect after import.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                placeholder="# Click 'Export from DB' to load current configuration..."
                className="font-mono text-sm min-h-[500px] resize-y"
              />
            </CardContent>
          </Card>

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration Reference</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>scoring.weights</strong>: Adjust how questions are prioritized
              </p>
              <p>
                <strong>slots</strong>: Define what information the agent collects
              </p>
              <p>
                <strong>questions</strong>: The question bank (20+ questions recommended)
              </p>
              <p>
                <strong>risk_rules</strong>: Detect conflicts in client answers
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

// ============================================
// Icons
// ============================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
