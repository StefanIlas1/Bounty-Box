# Bounty-Box: one-page pitch

**One-liner:** You describe the app you want and set a budget. Bounty-Box picks the stack, writes the code, load-tests it in a CreateOS sandbox, swaps out parts that fail or cost too much, then buys the stack through Stripe Projects and hands you a live URL.

**The user:** a solo developer or small team who knows what they want to build but loses days choosing a database, host and auth provider, then finds out at launch that it's too slow or too expensive.

**How it differs from Lovable or v0:** those tools generate code and leave the infrastructure decisions to you. Bounty-Box treats the stack as a purchase. It compares vendors, tests them under load, keeps you within budget, and actually buys the pieces.

## How it works

1. **Brief:** "A waitlist app with email signups that handles 1,000 users, for under $30 a month."
2. **Draft a stack:** it picks candidates from the Stripe Projects catalog, for example Postgres or a key-value store, plus a host.
3. **Write and run:** it writes the app and a load-test script, then runs both in a CreateOS sandbox.
4. **Self-fix:** if a test fails or the projected cost goes over budget, it rewrites the code or swaps a part of the stack and runs again. On screen this looks like: "Option A falls over at 800 users, switching to B."
5. **Approval:** you see the final stack, the monthly cost and the test results, then click approve.
6. **Buy and ship:** it runs `stripe projects add …` for each service, deploys, and returns a live URL.

## The X factor: partner deals

Bounty-Box brokers deals with vendors.

- **Deals for users:** an agent pitches SaaS vendors on partner rates. New vendors that want market share discount to get recommended, so users get cheaper stacks.
- **Revenue for us:** vendors pay placement or referral fees. This makes Bounty-Box a distribution channel for new dev-tool companies, which solves the cold-start problem that kills two-sided marketplaces.
- **Trust rule:** a partner product is only recommended if it passes the same tests and costs less than the best market alternative, and partner picks are always labeled. This answers the obvious judge question: "Isn't this just paid placement?"

## Fit with the judging criteria

| Criterion | What we show |
| --- | --- |
| Sponsor tools | Stripe Projects is how the agent buys services, not something added for the judges. CreateOS runs the load tests, a live URL serves the result, egress is allowlisted to the chosen vendors, and pause/resume holds the job while it waits for approval. |
| Writes, runs and fixes its own code | The stack swap after a failed load test is the self-fix moment, and it happens on camera. |
| Real-world use | Every developer has burned days choosing a stack or been surprised by a bill. |
| Execution | One narrow app type, 2–3 candidate stacks, one swap that happens reliably. |
| Creativity | An agent that shops for infrastructure, plus the partner-deal business model. |

## Scope for today (lock at 5:30 PM PT)

**Build for real:**

- One app template, such as a waitlist or a simple CRUD API.
- 2–3 swappable stacks from what Stripe Projects actually offers.
- The sandbox write → load test → swap loop.
- The approval screen.
- `stripe projects add` and the live URL.

**Fake or put on a slide:**

- The negotiation agent: show a drafted partner email and a "partner rate" badge in the price comparison. Don't email real vendors today.
- Shared hosting across users and big-company partnership pitches: roadmap slide.
- Its own email inbox for verification codes: skip it. Going through Stripe Projects avoids most vendor logins anyway, which is worth saying in the video.

## Risks

- **Sandbox limits:** the free plan allows 1 concurrent sandbox and 10 per day. Test stacks one after another and budget about 6 sandbox runs for development plus 2 for the demo.
- **Live spending:** use test mode, or the cheapest free tiers, so the demo doesn't spend real money.
- **Unreliable swap:** make the swap deterministic by setting a load target that the first stack is known to miss.
- **"Isn't it Lovable?":** open the video with the budget and the swap, not the code generation.

## Likely judge pushback (kept out of the README)

- **"Isn't this just Lovable or v0?"** No: those generate code and stop. Bounty-Box picks, load-tests, budgets and buys the infrastructure. Lead the demo with the budget and the swap.
- **"Isn't partner placement just paid ads?"** The trust rule: partners only win if they pass the same tests and beat the best market price, and they are always labeled.
- **"Is the swap staged?"** The load target is set so the first stack misses it, which makes the swap reliable on camera. Be upfront that the target is chosen, the test itself is real.
- **"Is the negotiation agent real?"** Not today: it is a drafted email and a badge. Present it as roadmap.
- **"Did it spend real money?"** Test mode or free tiers only.
