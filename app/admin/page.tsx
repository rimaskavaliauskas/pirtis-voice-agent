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
  verifyAdminKey,
  getReportFooter,
  setReportFooter,
  listFeedback,
  getFeedbackStats,
  listSessions,
  getExpertReviewStats,
  listSkillVersions,
  activateSkillVersion,
  generateRulesFromFeedback,
  getPendingRules,
  getApprovedRules,
  getAppliedRules,
  approveRule,
  rejectRule,
  createSkillVersionFromRules,
} from '@/lib/api';
import { toast } from 'sonner';
import type { FeedbackEntry, FeedbackStats, SessionListItem, ExpertReviewStats, SkillVersion, LearnedRule } from '@/lib/types';

// ============================================
// Types
// ============================================

type AdminState = 'not_authenticated' | 'authenticated' | 'loading';
type AdminTab = 'config' | 'feedback' | 'review' | 'skill';

// ============================================
// Component
// ============================================

export default function AdminPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<AdminState>('loading');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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

  // Expert review state
  const [sessionsList, setSessionsList] = useState<SessionListItem[]>([]);
  const [expertReviewStats, setExpertReviewStats] = useState<ExpertReviewStats | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  // Skill management state
  const [skillVersions, setSkillVersions] = useState<SkillVersion[]>([]);
  const [pendingRules, setPendingRules] = useState<LearnedRule[]>([]);
  const [approvedRules, setApprovedRules] = useState<LearnedRule[]>([]);
  const [appliedRules, setAppliedRules] = useState<LearnedRule[]>([]);
  const [showAppliedRules, setShowAppliedRules] = useState(false);
  const [skillLoading, setSkillLoading] = useState(false);
  const [generatingRules, setGeneratingRules] = useState(false);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [newVersionInput, setNewVersionInput] = useState('');
  const [approverName, setApproverName] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Theme state
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // Check if already authenticated - verify stored key against backend
  useEffect(() => {
    const checkStoredKey = async () => {
      const storedKey = typeof window !== 'undefined' ? localStorage.getItem('admin_key') : null;
      if (storedKey) {
        try {
          // Verify the stored key is still valid
          await verifyAdminKey(storedKey);
          setAuthState('authenticated');
        } catch {
          // Stored key is invalid - clear it and show auth dialog
          clearAdminKey();
          setAuthState('not_authenticated');
          setShowAuthDialog(true);
        }
      } else {
        setAuthState('not_authenticated');
        setShowAuthDialog(true);
      }
    };
    checkStoredKey();
  }, []);

  // Initialize theme from localStorage (default light for admin, .dark class for dark mode)
  // Restore dark mode when leaving admin (since frontend pages need dark theme)
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme');
    if (savedTheme === 'dark') {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkTheme(false);
      document.documentElement.classList.remove('dark');
    }
    // Cleanup: restore dark mode when leaving admin pages
    return () => {
      document.documentElement.classList.add('dark');
    };
  }, []);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setIsDarkTheme((prev) => {
      const newTheme = !prev;
      if (newTheme) {
        // Switch to dark
        document.documentElement.classList.add('dark');
        localStorage.setItem('admin_theme', 'dark');
      } else {
        // Switch to light
        document.documentElement.classList.remove('dark');
        localStorage.setItem('admin_theme', 'light');
      }
      return newTheme;
    });
  }, []);

  // Handle authentication
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuthenticate = useCallback(async () => {
    if (!adminKeyInput.trim()) {
      toast.error('Please enter an admin key');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Verify key against backend before granting access
      await verifyAdminKey(adminKeyInput.trim());

      // Key is valid - store it and grant access
      setAdminKey(adminKeyInput.trim());
      setAuthState('authenticated');
      setShowAuthDialog(false);
      toast.success('Authenticated successfully');
    } catch (error) {
      // Key is invalid
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsAuthenticating(false);
    }
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
      setYamlContent(response.yaml_content || '');
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
      const response = await validateBrainConfig({ yaml_content: yamlContent });

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
      const response = await importBrainConfig({ yaml_content: yamlContent });
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

  // Load sessions for expert review
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const hasReviewFilter = reviewFilter === 'pending' ? false : reviewFilter === 'reviewed' ? true : undefined;
      const [sessions, stats] = await Promise.all([
        listSessions({ limit: 50, completed_only: true, has_review: hasReviewFilter }),
        getExpertReviewStats(),
      ]);
      setSessionsList(sessions);
      setExpertReviewStats(stats);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      // Show specific error message
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Admin key')) {
          toast.error('Admin key required. Please logout and login again.');
        } else if (error.message.includes('403') || error.message.includes('Invalid admin')) {
          toast.error('Invalid admin key. Please logout and login with correct key.');
        } else {
          toast.error(`Failed to load sessions: ${error.message}`);
        }
      } else {
        toast.error('Failed to load sessions data');
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [reviewFilter]);

  // Load skill data
  const loadSkillData = useCallback(async () => {
    setSkillLoading(true);
    try {
      console.log('Loading skill data...');
      const [versions, pending, approved, applied] = await Promise.all([
        listSkillVersions(),
        getPendingRules(),
        getApprovedRules(),
        getAppliedRules(),
      ]);
      console.log('Skill versions loaded:', versions.length);
      console.log('Pending rules:', pending.length);
      console.log('Approved rules (ready):', approved.length);
      console.log('Applied rules (history):', applied.length);
      setSkillVersions(versions);
      setPendingRules(pending);
      setApprovedRules(approved);
      setAppliedRules(applied);
    } catch (error) {
      console.error('Failed to load skill data:', error);
      toast.error(`Failed to load skill data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSkillLoading(false);
    }
  }, []);

  // Generate rules from feedback
  const handleGenerateRules = useCallback(async () => {
    setGeneratingRules(true);
    try {
      const result = await generateRulesFromFeedback(1, 90); // min 1 review, last 90 days
      if (result.rules_generated > 0) {
        toast.success(`Generated ${result.rules_generated} rules from feedback`);
        loadSkillData();
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      console.error('Failed to generate rules:', error);
      toast.error('Failed to generate rules');
    } finally {
      setGeneratingRules(false);
    }
  }, [loadSkillData]);

  // Approve a rule
  const handleApproveRule = useCallback(async (ruleId: number) => {
    try {
      await approveRule(ruleId);
      toast.success('Rule approved');
      loadSkillData();
    } catch (error) {
      console.error('Failed to approve rule:', error);
      toast.error('Failed to approve rule');
    }
  }, [loadSkillData]);

  // Reject a rule
  const handleRejectRule = useCallback(async (ruleId: number) => {
    try {
      await rejectRule(ruleId);
      toast.success('Rule rejected');
      loadSkillData();
    } catch (error) {
      console.error('Failed to reject rule:', error);
      toast.error('Failed to reject rule');
    }
  }, [loadSkillData]);

  // Create new skill version from approved rules
  const handleCreateSkillVersion = useCallback(async () => {
    if (!newVersionInput.trim()) {
      toast.error('Please enter a version number');
      return;
    }
    if (selectedRules.size === 0) {
      toast.error('Please select at least one approved rule');
      return;
    }

    setCreatingVersion(true);
    try {
      const result = await createSkillVersionFromRules(
        newVersionInput,
        Array.from(selectedRules),
        approverName || 'Admin'
      );
      toast.success(result.message);
      setSelectedRules(new Set());
      setNewVersionInput('');
      loadSkillData();
    } catch (error) {
      console.error('Failed to create skill version:', error);
      toast.error('Failed to create skill version');
    } finally {
      setCreatingVersion(false);
    }
  }, [newVersionInput, selectedRules, approverName, loadSkillData]);

  // Activate a skill version
  const handleActivateVersion = useCallback(async (versionId: number) => {
    try {
      await activateSkillVersion(versionId);
      toast.success('Skill version activated');
      loadSkillData();
    } catch (error) {
      console.error('Failed to activate version:', error);
      toast.error('Failed to activate version');
    }
  }, [loadSkillData]);

  // Toggle rule selection
  const toggleRuleSelection = useCallback((ruleId: number) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (authState !== 'authenticated') return;

    if (activeTab === 'config') {
      loadFooter();
    } else if (activeTab === 'feedback') {
      loadFeedback();
    } else if (activeTab === 'review') {
      loadSessions();
    } else if (activeTab === 'skill') {
      loadSkillData();
    }
  }, [activeTab, authState, loadFooter, loadFeedback, loadSessions, loadSkillData]);

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
          <div className="py-4 space-y-3">
            <input
              type="password"
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              placeholder="Enter admin key..."
              className="w-full px-3 py-2 border rounded-md"
              onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
              disabled={isAuthenticating}
            />
            {authError && (
              <p className="text-sm text-red-500">{authError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push('/')} disabled={isAuthenticating}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate} disabled={isAuthenticating}>
              {isAuthenticating ? 'Verifying...' : 'Authenticate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      {authState === 'authenticated' && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <SaunaIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Pirtis Admin</h1>
                <p className="text-muted-foreground text-sm">
                  Configuration, feedback, expert reviews & skill evolution
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkTheme ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'config'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-white hover:bg-gray-100 dark:bg-white/5'
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
                  : 'text-gray-600 dark:text-gray-400 hover:text-white hover:bg-gray-100 dark:bg-white/5'
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
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'review'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-white hover:bg-gray-100 dark:bg-white/5'
              }`}
            >
              <ReviewIcon className="w-4 h-4 inline mr-2" />
              Expert Review
              {expertReviewStats && expertReviewStats.total_reviews > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                  {expertReviewStats.total_reviews}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('skill')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'skill'
                  ? 'bg-primary/20 text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-white hover:bg-gray-100 dark:bg-white/5'
              }`}
            >
              <SkillIcon className="w-4 h-4 inline mr-2" />
              Skill Evolution
              {pendingRules.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400">
                  {pendingRules.length}
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
                      <div className="text-center p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-primary">
                          {feedbackStats.total_count}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Responses</div>
                      </div>
                      <div className="text-center p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-1">
                          {feedbackStats.average_rating.toFixed(1)}
                          <StarIcon className="w-6 h-6" filled />
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Average Rating</div>
                      </div>
                      <div className="col-span-2 p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Rating Distribution</div>
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
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                      No feedback yet
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feedbackList.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"
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
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
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

          {/* Expert Review Tab Content */}
          {activeTab === 'review' && (
            <>
              {/* Stats Summary */}
              {expertReviewStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Expert Review Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-green-400">
                          {expertReviewStats.total_reviews}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Reviews Completed</div>
                      </div>
                      <div className="text-center p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-1">
                          {expertReviewStats.avg_overall_rating.toFixed(1)}
                          <StarIcon className="w-6 h-6" filled />
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Overall Rating</div>
                      </div>
                      <div className="text-center p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-blue-400">
                          {expertReviewStats.question_reviews.total}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Questions Reviewed</div>
                      </div>
                      <div className="text-center p-4 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <div className="text-3xl font-bold text-purple-400">
                          {expertReviewStats.question_reviews.avg_effectiveness.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Effectiveness</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sessions List */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Sessions for Review</CardTitle>
                    <CardDescription>
                      Completed interviews available for expert review
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={reviewFilter}
                      onChange={(e) => setReviewFilter(e.target.value as 'all' | 'pending' | 'reviewed')}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-gray-700 dark:text-gray-300"
                    >
                      <option value="all">All Sessions</option>
                      <option value="pending">Pending Review</option>
                      <option value="reviewed">Already Reviewed</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={loadSessions} disabled={sessionsLoading}>
                      {sessionsLoading ? (
                        <LoadingSpinner className="w-4 h-4" />
                      ) : (
                        'Refresh'
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {sessionsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner className="w-8 h-8" />
                    </div>
                  ) : sessionsList.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                      No completed sessions found
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessionsList.map((session) => (
                        <div
                          key={session.session_id}
                          className="p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/admin/review/${session.session_id}`)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                session.has_review
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {session.has_review ? 'Reviewed' : 'Pending'}
                              </span>
                              <span className="text-xs text-gray-500 uppercase">
                                {session.language} / {session.interview_mode}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              {session.contact_name ? (
                                <span className="text-gray-200">{session.contact_name}</span>
                              ) : (
                                <span className="text-gray-500 italic">Anonymous</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                              <span>{session.questions_count} Q&amp;A</span>
                              <span>{session.slots_filled} slots</span>
                              {session.has_report && (
                                <span className="text-green-400">Has Report</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            ID: {session.session_id.slice(0, 8)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Skill Evolution Tab Content */}
          {activeTab === 'skill' && (
            <>
              {/* Current Skill Version */}
              <Card>
                <CardHeader>
                  <CardTitle>Skill Versions</CardTitle>
                  <CardDescription>
                    Manage Pirtis Design Skill versions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {skillLoading ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner className="w-6 h-6" />
                    </div>
                  ) : skillVersions.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400">No skill versions found</p>
                  ) : (
                    <div className="space-y-2">
                      {skillVersions.map((version) => (
                        <div
                          key={version.id}
                          className={`p-3 rounded-lg border ${
                            version.is_active
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">v{version.version}</span>
                              {version.is_active && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                                  Active
                                </span>
                              )}
                              <span className="ml-2 text-xs text-gray-500">
                                {version.content_length.toLocaleString()} chars
                              </span>
                            </div>
                            {!version.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleActivateVersion(version.id)}
                              >
                                Activate
                              </Button>
                            )}
                          </div>
                          {version.change_summary && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{version.change_summary}</p>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {version.created_at ? new Date(version.created_at).toLocaleDateString() : 'N/A'}
                            {version.approved_by && ` by ${version.approved_by}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Generate Rules */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Generate Improvement Rules</CardTitle>
                    <CardDescription>
                      Analyze expert feedback to generate skill improvements
                    </CardDescription>
                  </div>
                  <Button onClick={handleGenerateRules} disabled={generatingRules}>
                    {generatingRules ? (
                      <>
                        <LoadingSpinner className="w-4 h-4 mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <BrainIcon className="w-4 h-4 mr-2" />
                        Generate Rules
                      </>
                    )}
                  </Button>
                </CardHeader>
              </Card>

              {/* New Rules (Pending) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    New Rules
                    {pendingRules.length > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                        {pendingRules.length} to review
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Review and approve rules generated from expert feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingRules.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                      No new rules. Click &quot;Generate Rules&quot; after collecting expert reviews.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pendingRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                                NEW
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                rule.rule_type === 'question_improvement' ? 'bg-blue-500/20 text-blue-400' :
                                rule.rule_type === 'new_question' ? 'bg-purple-500/20 text-purple-400' :
                                rule.rule_type === 'methodology' ? 'bg-green-500/20 text-green-400' :
                                'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                              }`}>
                                {rule.rule_type}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              Confidence: {(rule.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-200 mb-1">{rule.rule_text}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">EN: {rule.rule_text_en}</p>
                          {rule.source_pattern && (
                            <p className="text-xs text-gray-500 mb-2">Source: {rule.source_pattern}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRule(rule.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckIcon className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRule(rule.id)}
                              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ready to Apply (Approved but not incorporated) */}
              {approvedRules.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Ready to Apply
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                        {approvedRules.length} approved
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Select rules to incorporate into a new skill version
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {approvedRules.map((rule) => (
                        <label
                          key={rule.id}
                          className="flex items-start gap-3 p-3 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 cursor-pointer hover:border-primary/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRules.has(rule.id)}
                            onChange={() => toggleRuleSelection(rule.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 font-medium">
                                APPROVED
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                rule.rule_type === 'question_improvement' ? 'bg-blue-500/20 text-blue-400' :
                                rule.rule_type === 'new_question' ? 'bg-purple-500/20 text-purple-400' :
                                rule.rule_type === 'methodology' ? 'bg-green-500/20 text-green-400' :
                                'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                              }`}>
                                {rule.rule_type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-200">{rule.rule_text_en}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-4 items-end pt-4 border-t border-gray-200 dark:border-white/10">
                      <div className="flex-1">
                        <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">New Version</label>
                        <input
                          type="text"
                          value={newVersionInput}
                          onChange={(e) => setNewVersionInput(e.target.value)}
                          placeholder="e.g., 3.2"
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Approved By</label>
                        <input
                          type="text"
                          value={approverName}
                          onChange={(e) => setApproverName(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md"
                        />
                      </div>
                      <Button
                        onClick={handleCreateSkillVersion}
                        disabled={selectedRules.size === 0 || !newVersionInput || creatingVersion}
                      >
                        {creatingVersion ? (
                          <>
                            <LoadingSpinner className="w-4 h-4 mr-2" />
                            Creating...
                          </>
                        ) : (
                          'Create Version'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Applied Rules (History) - Collapsible */}
              {appliedRules.length > 0 && (
                <Card>
                  <CardHeader
                    className="cursor-pointer hover:bg-gray-100 dark:bg-white/5 transition-colors"
                    onClick={() => setShowAppliedRules(!showAppliedRules)}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        Applied Rules (History)
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-600 dark:text-gray-400">
                          {appliedRules.length} applied
                        </span>
                      </span>
                      <span className="text-gray-500 text-sm">
                        {showAppliedRules ? '▼' : '▶'}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Rules already incorporated into skill versions
                    </CardDescription>
                  </CardHeader>
                  {showAppliedRules && (
                    <CardContent>
                      <div className="space-y-2">
                        {appliedRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="p-3 bg-gray-100 dark:bg-white/5 rounded-lg border border-white/5 opacity-70"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-600 dark:text-gray-400 font-medium">
                                APPLIED
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                rule.rule_type === 'question_improvement' ? 'bg-blue-500/20 text-blue-400' :
                                rule.rule_type === 'new_question' ? 'bg-purple-500/20 text-purple-400' :
                                rule.rule_type === 'methodology' ? 'bg-green-500/20 text-green-400' :
                                'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                              }`}>
                                {rule.rule_type}
                              </span>
                              {rule.incorporated_in_skill && (
                                <span className="text-xs text-gray-500">
                                  → Skill v{rule.incorporated_in_skill}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{rule.rule_text_en}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
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

function ReviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function SkillIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54" />
    </svg>
  );
}

function SaunaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Simple house with steam */}
      <path d="M3 21h18" />
      <path d="M5 21V11l7-7 7 7v10" />
      <path d="M9 21v-6h6v6" />
      {/* Steam lines */}
      <path d="M12 3v-1" strokeDasharray="2 2" />
      <path d="M9 4v-2" strokeDasharray="2 2" />
      <path d="M15 4v-2" strokeDasharray="2 2" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
