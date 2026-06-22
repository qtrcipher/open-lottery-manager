export type VerificationEntry = {
  isEligible: boolean;
};

export type VerificationWinner = {
  rank: number;
  prize: {
    name: string;
  };
  entry: {
    name: string;
    ticketCode: string;
  };
};

export type VerificationWinnerRow = {
  rank: number;
  prizeName: string;
  participantName: string;
  ticketCode: string;
};

export type DrawVerificationSummary = {
  totalEntryCount: number;
  eligibleEntryCount: number;
  winnerCount: number;
  winners: VerificationWinnerRow[];
};

export function createDrawVerificationSummary(
  entries: VerificationEntry[],
  winners: VerificationWinner[]
): DrawVerificationSummary {
  const orderedWinners = [...winners]
    .sort((first, second) => first.rank - second.rank)
    .map((winner) => ({
      rank: winner.rank,
      prizeName: winner.prize.name,
      participantName: winner.entry.name,
      ticketCode: winner.entry.ticketCode
    }));

  return {
    totalEntryCount: entries.length,
    eligibleEntryCount: entries.filter((entry) => entry.isEligible).length,
    winnerCount: orderedWinners.length,
    winners: orderedWinners
  };
}
