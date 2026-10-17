# Bounty-Box

Describe the app you want and set a budget. Bounty-Box picks the stack, writes the code, load-tests it in a CreateOS sandbox, swaps out parts that fail or cost too much, then buys the stack through Stripe Projects and hands you a live URL.

Built at **Build Agents That Run Code: CreateOS × Stripe Projects** (Oct 17, 2026) by Mohsen Sarrafan ([@mohsensc](https://github.com/mohsensc)) and Stefan Ilas ([@StefanIlas1](https://github.com/StefanIlas1)).

## What it does

1. **Brief:** you give it an app and a budget, e.g. "A waitlist app with email signups that handles 1,000 users, for under $30 a month."
2. **Draft a stack:** it picks candidate services from the Stripe Projects catalog (database, key-value store, host).
3. **Write and run:** it writes the app plus a load-test script and runs both in a CreateOS sandbox.
4. **Self-fix:** if the load test fails or projected cost exceeds the budget, it rewrites the code or swaps a stack component and runs again.
5. **Approve:** you review the final stack, monthly cost and test results.
6. **Buy and ship:** it runs `stripe projects add …` for each service, deploys, and returns a live URL.

See [design.md](design.md) for the full pitch, scope and risks.

## Tech

- **Stripe Projects**: provisions and buys the chosen services (`stripe projects add`).
- **CreateOS Sandbox**: runs the generated app and load tests, with egress allowlisting, a live ingress URL, and pause/resume while waiting for approval.

## How to run

Setup instructions are added here as the build lands.
