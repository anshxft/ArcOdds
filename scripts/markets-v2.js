// Markets seeded on PredictArcV2. `deadline` is when trading closes (UTC).
// Every outcome must be knowable within RESOLUTION_WINDOW (30 days) of its deadline,
// otherwise anyone can cancel the market and bettors get refunds.
const MARKETS_V2 = [
  {
    question: "Will Bitcoin close above $75,000 on December 31, 2026?",
    category: "crypto",
    rules: "YES if CoinGecko's BTC/USD daily close for 31 Dec 2026 (UTC) is above $75,000. Otherwise NO.",
    deadline: "2026-12-31T00:00:00Z",
  },
  {
    question: "Will Ethereum close above $3,000 on December 31, 2026?",
    category: "crypto",
    rules: "YES if CoinGecko's ETH/USD daily close for 31 Dec 2026 (UTC) is above $3,000. Otherwise NO.",
    deadline: "2026-12-31T00:00:00Z",
  },
  {
    question: "Will the Fed cut rates at its December 2026 meeting?",
    category: "finance",
    rules: "YES if the FOMC statement of 9 Dec 2026 lowers the federal funds target range. A hold or hike is NO. Source: federalreserve.gov.",
    deadline: "2026-12-09T18:00:00Z",
  },
  {
    question: "Will gold trade above $4,500 an ounce on March 31, 2027?",
    category: "finance",
    rules: "YES if the LBMA Gold Price PM (USD) on 31 Mar 2027 is above $4,500. If no fixing that day, the last fixing before it is used.",
    deadline: "2027-03-31T00:00:00Z",
  },
  {
    question: "Will Democrats win control of the US House in the 2026 midterms?",
    category: "politics",
    rules: "YES if Democrats win at least 218 House seats in the 3 Nov 2026 election, per Associated Press race calls. Otherwise NO.",
    deadline: "2026-11-03T11:00:00Z",
  },
  {
    question: "Will Republicans keep control of the US Senate after the 2026 midterms?",
    category: "politics",
    rules: "YES if Republicans hold a Senate majority (including a Vice President tie-break) based on 3 Nov 2026 results, per Associated Press calls.",
    deadline: "2026-11-03T11:00:00Z",
  },
  {
    question: "Will GTA VI launch on November 19, 2026?",
    category: "entertainment",
    rules: "YES if Grand Theft Auto VI is playable on PS5 or Xbox Series X|S in any region on 19 Nov 2026, per Rockstar Games. Any delay is NO.",
    deadline: "2026-11-19T00:00:00Z",
  },
  {
    question: "Will Google release a model named Gemini 4 before March 31, 2027?",
    category: "tech",
    rules: "YES if Google makes a model officially named Gemini 4 (any size) publicly available, in preview or GA, before 31 Mar 2027 (UTC). Announcements alone are NO.",
    deadline: "2027-03-31T00:00:00Z",
  },
  {
    question: "Will an English club win the 2026-27 Champions League?",
    category: "sports",
    rules: "YES if the winner of the 2027 UEFA Champions League final is a club from the English league system, per UEFA. Otherwise NO.",
    deadline: "2027-05-29T00:00:00Z",
  },
  {
    question: "Will Real Madrid win La Liga 2026-27?",
    category: "sports",
    rules: "YES if Real Madrid are the official 2026-27 La Liga champions, per LaLiga. Otherwise NO.",
    deadline: "2027-05-15T00:00:00Z",
  },
];

module.exports = { MARKETS_V2 };
