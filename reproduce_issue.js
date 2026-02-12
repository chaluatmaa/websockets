import { createMatchSchema } from './src/validation/matches.js';
import { getMatchStatus } from './src/utils/match-status.js';

const body = {
    "sport":"football",
    "homeTeam":"Man City",
    "awayTeam":"JSM United",
    "startTime":"2026-12-01T12:00:00.000Z",
    "endTime":"2026-12-01T15:00:00.000Z"
};

const parsed = createMatchSchema.safeParse(body);
console.log('Validation success:', parsed.success);
if (!parsed.success) {
    console.log('Validation errors:', JSON.stringify(parsed.error.format(), null, 2));
} else {
    const {startTime, endTime, homeScore, awayScore} = parsed.data;
    console.log('Destructured:', {startTime, endTime, homeScore, awayScore});
    const status = getMatchStatus(startTime, endTime);
    console.log('Status:', status);
    
    const insertValues = {
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: status
    };
    console.log('Insert values:', insertValues);
}
