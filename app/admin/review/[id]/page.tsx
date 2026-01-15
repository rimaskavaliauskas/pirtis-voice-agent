'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getSessionForReview, submitExpertReview, deleteSession, translateText } from '@/lib/api';
import { toast } from 'sonner';
import type { SessionReviewData, QuestionReviewInput, ExpertReviewInput } from '@/lib/types';

// ============================================
// Component
// ============================================

export default function SessionReviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionData, setSessionData] = useState<SessionReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [reviewerName, setReviewerName] = useState('');
  const [overallRating, setOverallRating] = useState(3);
  const [overallComments, setOverallComments] = useState('');
  const [questionReviews, setQuestionReviews] = useState<Record<string, {
    rating: number;
    whatCouldBeBetter: string;
    suggestedAlternative: string;
  }>>({});
  const [summaryReview, setSummaryReview] = useState({
    accuracyRating: 3,
    completenessRating: 3,
    whatCouldBeBetter: '',
  });
  const [translatedReport, setTranslatedReport] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Initialize theme from localStorage (must match admin page - default light, .dark for dark)
  // Restore dark mode when leaving admin (since frontend pages need dark theme)
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Cleanup: restore dark mode when leaving admin pages
    return () => {
      document.documentElement.classList.add('dark');
    };
  }, []);

  // Load session data
  useEffect(() => {
    async function loadSession() {
      if (!sessionId) return;

      const adminKey = localStorage.getItem('admin_key');
      if (!adminKey) {
        router.push('/admin');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getSessionForReview(sessionId);
        setSessionData(data);

        // Initialize question reviews
        const initialReviews: typeof questionReviews = {};
        data.questions_answers.forEach((qa) => {
          initialReviews[qa.question_id] = {
            rating: 3,
            whatCouldBeBetter: '',
            suggestedAlternative: '',
          };
        });
        setQuestionReviews(initialReviews);

        // If there's an existing review, populate the form
        if (data.existing_review) {
          setReviewerName(data.existing_review.reviewer_name || '');
          setOverallRating(data.existing_review.overall_rating);
          setOverallComments(data.existing_review.overall_comments || '');

          // Populate question reviews
          const existingQReviews: typeof questionReviews = {};
          data.existing_review.question_reviews.forEach((qr) => {
            existingQReviews[qr.question_id] = {
              rating: qr.effectiveness_rating,
              whatCouldBeBetter: qr.what_could_be_better || '',
              suggestedAlternative: qr.suggested_alternative || '',
            };
          });
          setQuestionReviews(existingQReviews);

          // Populate summary review
          if (data.existing_review.summary_review) {
            setSummaryReview({
              accuracyRating: data.existing_review.summary_review.accuracy_rating,
              completenessRating: data.existing_review.summary_review.completeness_rating,
              whatCouldBeBetter: data.existing_review.summary_review.what_could_be_better || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        setError('Failed to load session data');
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [sessionId, router]);

  // Handle question review change
  const updateQuestionReview = useCallback((questionId: string, field: string, value: string | number) => {
    setQuestionReviews((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
  }, []);

  // Submit review
  const handleSubmit = useCallback(async () => {
    if (!sessionData) return;

    // Validate
    if (overallRating < 1 || overallRating > 5) {
      toast.error('Please provide an overall rating');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build question reviews
      const qReviews: QuestionReviewInput[] = sessionData.questions_answers.map((qa) => ({
        question_id: qa.question_id,
        original_question: qa.question_text,
        user_response: qa.answer_text,
        effectiveness_rating: questionReviews[qa.question_id]?.rating || 3,
        what_could_be_better: questionReviews[qa.question_id]?.whatCouldBeBetter || undefined,
        suggested_alternative: questionReviews[qa.question_id]?.suggestedAlternative || undefined,
      }));

      // Build review input
      const reviewInput: ExpertReviewInput = {
        reviewer_name: reviewerName || undefined,
        overall_rating: overallRating,
        overall_comments: overallComments || undefined,
        question_reviews: qReviews,
        summary_review: sessionData.final_report ? {
          original_summary: sessionData.final_report,
          accuracy_rating: summaryReview.accuracyRating,
          completeness_rating: summaryReview.completenessRating,
          what_could_be_better: summaryReview.whatCouldBeBetter || undefined,
        } : undefined,
      };

      await submitExpertReview(sessionId, reviewInput);
      toast.success('Review submitted successfully');
      router.push('/admin?tab=review');
    } catch (err) {
      console.error('Failed to submit review:', err);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionData, sessionId, reviewerName, overallRating, overallComments, questionReviews, summaryReview, router]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await deleteSession(sessionId);
      toast.success(`Session deleted. Removed: ${result.deleted_counts.sessions} session, ${result.deleted_counts.messages} messages, ${result.deleted_counts.expert_reviews} reviews`);
      router.push('/admin?tab=review');
    } catch (err) {
      console.error('Failed to delete session:', err);
      toast.error('Failed to delete session');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [sessionId, router]);

  // Handle report translation
  const handleTranslateReport = useCallback(async (targetLang: 'en' | 'ru') => {
    if (!sessionData?.final_report) return;

    setIsTranslating(true);
    try {
      const translated = await translateText(sessionData.final_report, targetLang);
      setTranslatedReport(translated);
      toast.success(`Report translated to ${targetLang.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to translate report:', err);
      toast.error('Failed to translate report');
    } finally {
      setIsTranslating(false);
    }
  }, [sessionData?.final_report]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner className="w-10 h-10" />
      </main>
    );
  }

  if (error || !sessionData) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">{error || 'Session not found'}</p>
              <Button className="mt-4" onClick={() => router.push('/admin')}>
                Back to Admin
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const hasExistingReview = !!sessionData.existing_review;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Expert Review</h1>
            <p className="text-muted-foreground">
              Session {sessionId.slice(0, 8)}... | {sessionData.language.toUpperCase()} | {sessionData.interview_mode}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete Session
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Back to Admin
            </Button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Session?</CardTitle>
                <CardDescription>
                  This action cannot be undone. This will permanently delete:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                  <li>The session and all conversation history</li>
                  <li>All transcripts and messages</li>
                  <li>Any expert reviews for this session</li>
                  <li>The final report</li>
                </ul>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <LoadingSpinner className="w-4 h-4 mr-2" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete Session'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {hasExistingReview && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">
              This session has already been reviewed by {sessionData.existing_review?.reviewer_name || 'Anonymous'} on{' '}
              {sessionData.existing_review?.created_at ? new Date(sessionData.existing_review.created_at).toLocaleDateString() : 'unknown date'}.
              You can view the review below but cannot submit a new one.
            </p>
          </div>
        )}

        {/* Questions & Answers Review */}
        <Card>
          <CardHeader>
            <CardTitle>Questions &amp; Answers Review</CardTitle>
            <CardDescription>
              Review each question-answer pair and rate effectiveness
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sessionData.questions_answers.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">No Q&A data available</p>
            ) : (
              sessionData.questions_answers.map((qa, index) => (
                <div
                  key={qa.question_id}
                  className="p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-500">Round {qa.round} - Q{index + 1}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">{qa.question_id}</span>
                  </div>

                  {/* Question */}
                  <div>
                    <label className="text-xs text-blue-600 dark:text-blue-400 font-medium block mb-1">Question Asked</label>
                    <p className="text-gray-800 dark:text-gray-200">{qa.question_text}</p>
                  </div>

                  {/* Answer */}
                  <div>
                    <label className="text-xs text-green-600 dark:text-green-400 font-medium block mb-1">User Response</label>
                    <p className="text-gray-700 dark:text-gray-300">{qa.answer_text || <span className="italic text-gray-500 dark:text-gray-500">No response</span>}</p>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">Effectiveness Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => !hasExistingReview && updateQuestionReview(qa.question_id, 'rating', star)}
                          className={`p-1 ${hasExistingReview ? 'cursor-default' : 'hover:bg-gray-200 dark:hover:bg-white/10'} rounded`}
                          disabled={hasExistingReview}
                        >
                          <StarIcon className="w-5 h-5" filled={star <= (questionReviews[qa.question_id]?.rating || 3)} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* What could be better */}
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">What could be better?</label>
                    <Textarea
                      value={questionReviews[qa.question_id]?.whatCouldBeBetter || ''}
                      onChange={(e) => updateQuestionReview(qa.question_id, 'whatCouldBeBetter', e.target.value)}
                      placeholder="Suggestions for improvement..."
                      className="min-h-[60px] text-sm"
                      disabled={hasExistingReview}
                    />
                  </div>

                  {/* Suggested alternative */}
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">Suggested Alternative Question</label>
                    <Textarea
                      value={questionReviews[qa.question_id]?.suggestedAlternative || ''}
                      onChange={(e) => updateQuestionReview(qa.question_id, 'suggestedAlternative', e.target.value)}
                      placeholder="A better way to ask this..."
                      className="min-h-[60px] text-sm"
                      disabled={hasExistingReview}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Summary/Report Review */}
        {sessionData.final_report && (
          <Card>
            <CardHeader>
              <CardTitle>Final Report Review</CardTitle>
              <CardDescription>
                Review the generated report for accuracy and completeness
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Translation buttons */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Translate report:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTranslateReport('en')}
                  disabled={isTranslating}
                >
                  {isTranslating ? <LoadingSpinner className="w-3 h-3" /> : 'EN'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTranslateReport('ru')}
                  disabled={isTranslating}
                >
                  {isTranslating ? <LoadingSpinner className="w-3 h-3" /> : 'RU'}
                </Button>
                {translatedReport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTranslatedReport(null)}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    Show Original (LT)
                  </Button>
                )}
              </div>

              {/* Report Preview */}
              <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 max-h-[400px] overflow-y-auto">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {translatedReport || sessionData.final_report}
                </pre>
              </div>

              {/* Accuracy Rating */}
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Accuracy Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => !hasExistingReview && setSummaryReview((prev) => ({ ...prev, accuracyRating: star }))}
                      className={`p-1 ${hasExistingReview ? 'cursor-default' : 'hover:bg-gray-200 dark:hover:bg-white/10'} rounded`}
                      disabled={hasExistingReview}
                    >
                      <StarIcon className="w-6 h-6" filled={star <= summaryReview.accuracyRating} />
                    </button>
                  ))}
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">How accurately does the report reflect the conversation?</span>
                </div>
              </div>

              {/* Completeness Rating */}
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Completeness Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => !hasExistingReview && setSummaryReview((prev) => ({ ...prev, completenessRating: star }))}
                      className={`p-1 ${hasExistingReview ? 'cursor-default' : 'hover:bg-gray-200 dark:hover:bg-white/10'} rounded`}
                      disabled={hasExistingReview}
                    >
                      <StarIcon className="w-6 h-6" filled={star <= summaryReview.completenessRating} />
                    </button>
                  ))}
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">Are all important points covered?</span>
                </div>
              </div>

              {/* What could be better */}
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">What could be better in the report?</label>
                <Textarea
                  value={summaryReview.whatCouldBeBetter}
                  onChange={(e) => setSummaryReview((prev) => ({ ...prev, whatCouldBeBetter: e.target.value }))}
                  placeholder="Suggestions for improving the report generation..."
                  className="min-h-[100px]"
                  disabled={hasExistingReview}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Evaluation - At the end, before submit */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Evaluation</CardTitle>
            <CardDescription>
              Rate the overall interview session after reviewing all Q&A and the report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Your Name (optional)</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Expert reviewer name..."
                className="w-full px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md"
                disabled={hasExistingReview}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Overall Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => !hasExistingReview && setOverallRating(star)}
                    className={`p-2 transition-colors ${hasExistingReview ? 'cursor-default' : 'hover:bg-gray-200 dark:hover:bg-white/10'} rounded`}
                    disabled={hasExistingReview}
                  >
                    <StarIcon className="w-8 h-8" filled={star <= overallRating} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Overall Comments</label>
              <Textarea
                value={overallComments}
                onChange={(e) => setOverallComments(e.target.value)}
                placeholder="General feedback about this interview session..."
                className="min-h-[100px]"
                disabled={hasExistingReview}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {!hasExistingReview && (
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </Button>
          </div>
        )}
      </div>
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
