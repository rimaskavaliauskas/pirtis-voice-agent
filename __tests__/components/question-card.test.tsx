import { render, screen } from '@testing-library/react';
import { QuestionCard } from '@/components/question-card';

describe('QuestionCard', () => {
  const defaultProps = {
    questionNumber: 1,
    questionText: 'What is your preferred sauna temperature?',
    status: 'idle' as const,
  };

  it('renders question number and text', () => {
    render(<QuestionCard {...defaultProps} />);

    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByText('What is your preferred sauna temperature?')).toBeInTheDocument();
  });

  it('shows Pending status for idle state', () => {
    render(<QuestionCard {...defaultProps} status="idle" />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Recording status with pulse indicator', () => {
    render(<QuestionCard {...defaultProps} status="recording" />);

    expect(screen.getByText('Recording')).toBeInTheDocument();
  });

  it('shows Processing status', () => {
    render(<QuestionCard {...defaultProps} status="processing" />);

    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('shows Review status for done state', () => {
    render(<QuestionCard {...defaultProps} status="done" />);

    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('shows Done status for confirmed state', () => {
    render(<QuestionCard {...defaultProps} status="confirmed" />);

    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('applies active styling when isActive is true', () => {
    const { container } = render(<QuestionCard {...defaultProps} isActive={true} />);

    // Check for scale class (active styling)
    expect(container.firstChild).toHaveClass('scale-[1.02]');
  });

  it('applies confirmed styling when status is confirmed', () => {
    const { container } = render(<QuestionCard {...defaultProps} status="confirmed" />);

    // Check for green border (confirmed styling)
    expect(container.firstChild).toHaveClass('border-green-500/30');
  });
});
