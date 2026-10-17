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

## Hardware mode: for physical builders

The same loop, for physical products. Instead of buying a software stack, Bounty-Box buys parts.

1. **Brief:** "A desk air-quality monitor, 50 units, under $40 per unit landed, delivered to Toronto by Nov 15."
2. **Design:** the agent writes a parametric CAD model (CadQuery or OpenSCAD) and a bill of materials (BOM) with the specs each part must meet: sensor accuracy, board size, voltage, enclosure dimensions.
3. **Source:** it searches eBay (Browse API) and Chinese suppliers (AliExpress, Alibaba, LCSC, JLCPCB) for parts that meet each spec.
4. **Landed cost:** for each candidate it adds unit price, shipping, import duty and tariffs (by HS code), customs brokerage and currency conversion, and checks minimum order quantity and the delivery date against the deadline.
5. **Self-fix:** the CAD script runs in a CreateOS sandbox and checks that the chosen parts physically fit the enclosure. If a part doesn't fit, misses the deadline or breaks the budget, the agent swaps it, regenerates the model and checks again. On screen: "Supplier A's sensor arrives Nov 22, after your deadline. Switching to a US eBay seller, +$3 per unit."
6. **Approval:** you see the 3D model, the blueprint, and the BOM with landed cost and arrival dates per part.
7. **Buy:** checkout runs through Stripe, which places the orders in one approved purchase.

### Demo UI

This part is built light on the backend, but the UI has to be clean and clear on camera. Open-source tools only:

- **3D view:** three.js via react-three-fiber (or Online3DViewer for STEP files), with orbit, exploded view, and parts highlighted when you hover their BOM row.
- **Blueprints:** 2D drawings with dimensions exported from CadQuery as SVG; KiCad (`kicad-cli`) for schematics and PCB drawings if the product has a board.
- **Layout:** BOM and supplier cards on the left, the 3D/Blueprint viewer in the centre (tabs), landed cost and a delivery timeline against the deadline on the right. The swap animates: the old part fades out of the model and the new one drops in.
- **Style:** follows the brand palette; tinted dark themes only, never gold on pure black.

## Fit with the judging criteria

| Criterion | What we show |
| --- | --- |
| Sponsor tools | Stripe Projects is how the agent buys services, not something added for the judges. CreateOS runs the load tests, a live URL serves the result, egress is allowlisted to the chosen vendors, and pause/resume holds the job while it waits for approval. |
| Writes, runs and fixes its own code | The stack swap after a failed load test is the self-fix moment, and it happens on camera. |
| Real-world use | Every developer has burned days choosing a stack or been surprised by a bill. |
| Execution | One narrow app type, 2–3 candidate stacks, one swap that happens reliably. |
| Creativity | An agent that shops for infrastructure, plus the partner-deal business model. Hardware mode extends the same loop to physical parts, with a live 3D model of what you're buying. |

## Scope for today (lock at 5:30 PM PT)

**Build for real:**

- One app template, such as a waitlist or a simple CRUD API.
- 2–3 swappable stacks from what Stripe Projects actually offers.
- The sandbox write → load test → swap loop.
- The approval screen.
- `stripe projects add` and the live URL.
- Hardware mode UI: 3D viewer, blueprint tab, BOM with landed cost, delivery timeline and one animated part swap, for a single demo product.
- Hardware mode logic, kept light: the CAD script and fit check running in the sandbox, plus the landed-cost and deadline calculation.

**Fake or put on a slide:**

- The negotiation agent: show a drafted partner email and a "partner rate" badge in the price comparison. Don't email real vendors today.
- Shared hosting across users and big-company partnership pitches: roadmap slide.
- Hardware sourcing data: use a fixed set of supplier listings (clearly labelled as sample data) and a small duty-rate table. A live eBay Browse API call is a bonus if time allows.
- Hardware purchases: Stripe test mode only. No real orders.
- Its own email inbox for verification codes: skip it. Going through Stripe Projects avoids most vendor logins anyway, which is worth saying in the video.

## Risks

- **Sandbox limits:** the free plan allows 1 concurrent sandbox and 10 per day. Test stacks one after another and budget about 6 sandbox runs for development plus 2 for the demo.
- **Live spending:** use test mode, or the cheapest free tiers, so the demo doesn't spend real money.
- **Unreliable swap:** make the swap deterministic by setting a load target that the first stack is known to miss.
- **Hardware scope creep:** hardware mode is secondary. Get the software loop working first, then spend what's left on the hardware UI.
- **"Isn't it Lovable?":** open the video with the budget and the swap, not the code generation.

## Likely judge pushback (kept out of the README)

- **"Isn't this just Lovable or v0?"** No: those generate code and stop. Bounty-Box picks, load-tests, budgets and buys the infrastructure. Lead the demo with the budget and the swap.
- **"Isn't partner placement just paid ads?"** The trust rule: partners only win if they pass the same tests and beat the best market price, and they are always labeled.
- **"Is the swap staged?"** The load target is set so the first stack misses it, which makes the swap reliable on camera. Be upfront that the target is chosen, the test itself is real.
- **"Is the negotiation agent real?"** Not today: it is a drafted email and a badge. Present it as roadmap.
- **"Did it spend real money?"** Test mode or free tiers only.
- **"Is the hardware sourcing live?"** For the demo, supplier listings are a labelled sample set. The CAD generation, fit check and landed-cost maths are real.
- **"Are the import fees accurate?"** They are estimates from HS-code duty rates; a customs broker confirms them before a real order.
- **"Scraping marketplaces breaks their terms."** We use official APIs (eBay Browse, supplier APIs), not scraping.
