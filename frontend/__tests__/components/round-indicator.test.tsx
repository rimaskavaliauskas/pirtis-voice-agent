import { render, screen } from '@testing-library/react';
import { RoundIndicator } from '@/components/round-indicator';

describe('RoundIndicator', () => {
  it('renders all three rounds', () => {
    render(<RoundIndicator currentRound={1} />);

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getByText('Round 3')).toBeInTheDocument();
  });

  it('shows current round as active', () => {
    render(<RoundIndicator currentRound={2} />);

    // Round 1 should be completed (has check icon)
    // Round 2 should be current (primary color)
    // Round 3 should be pending (muted)
    const round2Element = screen.getByText('Round 2').closest('div');
    expect(round2Element).toHaveClass('bg-primary');
  });

  it('shows correct progress percentage', () => {
    render(
      <RoundIndicator
        currentRound={2}
        questionsAnswered={2}
        totalQuestions={3}
      />
    );

    // Round 1 complete (3) + Round 2 answered (2) = 5 of 9 = ~56%
    expect(screen.getByText('56% complete')).toBeInTheDocument();
  });

  it('shows question progress within round', () => {
    render(
      <RoundIndicator
        currentRound={1}
        questionsAnswered={2}
        totalQuestions={3}
      />
    );

    expect(screen.getByText('Question 2/3 in Round 1')).toBeInTheDocument();
  });

  it('calculates 0% for start of interview', () => {
    render(
      <RoundIndicator
        currentRound={1}
        questionsAnswered={0}
        totalQuestions={3}
      />
    );

    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('calculates 100% when all rounds complete', () => {
    render(
      <RoundIndicator
        currentRound={3}
        questionsAnswered={3}
        totalQuestions={3}
        totalRounds={3}
      />
    );

    // (2 * 3 + 3) / 9 = 100%
    expect(screen.getByText('100% complete')).toBeInTheDocument();
  });
});
