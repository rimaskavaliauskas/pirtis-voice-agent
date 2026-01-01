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
  getReportFooter,
  setReportFooter,
  listFeedback,
  getFeedbackStats,
} from '@/lib/api';
import { toast } from 'sonner';
import type { FeedbackEntry, FeedbackStats } from '@/lib/types';

// ============================================
// Types
// ============================================

type AdminState = 'not_authenticated' | 'authenticated' | 'loading';
type AdminTab = 'config' | 'feedback';

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

  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>('config');

  // Footer state
  const [footerText, setFooterText] = useState('');
  const [footerLoading, setFooterLoading] = useState(false);

  // Feedback state
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

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

  // Load footer text
  const loadFooter = useCallback(async () => {
    setFooterLoading(true);
    try {
      const response = await getReportFooter();
      setFooterText(response.report_footer || '');
    } catch (error) {
      console.error('Failed to load footer:', error);
    } finally {
      setFooterLoading(false);
    }
  }, []);

  // Save footer text
  const handleSaveFooter = useCallback(async () => {
    setFooterLoading(true);
    try {
      await setReportFooter(footerText);
      toast.success('Report footer saved');
    } catch (error) {
      console.error('Failed to save footer:', error);
      toast.error('Failed to save footer');
    } finally {
      setFooterLoading(false);
    }
  }, [footerText]);

  // Load feedback data
  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const [entries, stats] = await Promise.all([
        listFeedback({ limit: 50 }),
        getFeedbackStats(),
      ]);
      setFeedbackList(entries);
      setFeedbackStats(stats);
    } catch (error) {
      console.error('Failed to load feedback:', error);
      toast.error('Failed to load feedback data');
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (authState !== 'authenticated') return;

    if (activeTab === 'config') {
      loadFooter();
    } else if (activeTab === 'feedback') {
      loadFeedback();
    }
  }, [activeTab, authState, loadFooter, loadFeedback]);

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
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-muted-foreground">
                Manage brain configuration, report settings, and feedback
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'config'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ConfigIcon className="w-4 h-4 inline mr-2" />
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'feedback'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FeedbackIcon className="w-4 h-4 inline mr-2" />
              Feedback
              {feedbackStats && feedbackStats.total_count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                  {feedbackStats.total_count}
                </span>
              )}
            </button>
          </div>

          {/* Config Tab Content */}
          {activeTab === 'config' && (
            <>
              {/* Report Footer */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Footer</CardTitle>
                  <CardDescription>
                    Text that appears at the bottom of every generated report
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="© Your Company | www.example.com | +370 600 00000"
                    className="font-mono text-sm min-h-[100px] resize-y"
                    disabled={footerLoading}
                  />
                  <Button onClick={handleSaveFooter} disabled={footerLoading}>
                    {footerLoading ? (
                      <>
                        <LoadingSpinner className="w-4 h-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <SaveIcon className="w-4 h-4 mr-2" />
                        Save Footer
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

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
            </>
          )}

          {/* Feedback Tab Content */}
          {activeTab === 'feedback' && (
            <>
              {/* Stats Summary */}
              {feedbackStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Feedback Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-primary">
                          {feedbackStats.total_count}
                        </div>
                        <div className="text-sm text-gray-400">Total Responses</div>
                      </div>
                      <div className="text-center p-4 bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-1">
                          {feedbackStats.average_rating.toFixed(1)}
                          <StarIcon className="w-6 h-6" filled />
                        </div>
                        <div className="text-sm text-gray-400">Average Rating</div>
                      </div>
                      <div className="col-span-2 p-4 bg-white/5 rounded-lg">
                        <div className="text-sm text-gray-400 mb-2">Rating Distribution</div>
                        <div className="flex items-end gap-1 h-12">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const count = feedbackStats.rating_distribution[star] || 0;
                            const maxCount = Math.max(...Object.values(feedbackStats.rating_distribution), 1);
                            const height = (count / maxCount) * 100;
                            return (
                              <div key={star} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full bg-amber-400/60 rounded-t"
                                  style={{ height: `${Math.max(height, 4)}%` }}
                                />
                                <span className="text-xs text-gray-500">{star}★</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Feedback List */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Feedback</CardTitle>
                    <CardDescription>
                      User feedback from completed interviews
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadFeedback} disabled={feedbackLoading}>
                    {feedbackLoading ? (
                      <LoadingSpinner className="w-4 h-4" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {feedbackLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner className="w-8 h-8" />
                    </div>
                  ) : feedbackList.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No feedback yet
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feedbackList.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-4 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <StarIcon
                                  key={star}
                                  className="w-4 h-4"
                                  filled={star <= entry.rating}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {entry.feedback_text && (
                            <p className="text-sm text-gray-300 mt-2">
                              &ldquo;{entry.feedback_text}&rdquo;
                            </p>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            Session: {entry.session_id.slice(0, 8)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
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

function ConfigIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </svg>
  );
}

function StarIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg
      className={`${className} transition-colors ${filled ? 'text-amber-400' : 'text-gray-600'}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
