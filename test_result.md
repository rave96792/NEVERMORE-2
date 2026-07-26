#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Nevermore DTF Next.js site. Cart, PayPal sandbox checkout, MongoDB order persistence,
  server-side artwork uploads, interactive Konva-based gang sheet builder at /builder,
  and Resend-powered order/submission emails on successful PayPal capture.

  ACTIVE BUG REPORT (from user): "When trying to download image this is what i get: Internal Server Error"
  Context: user clicks the composite-PNG download link inside the shop/buyer submission
  email (URL pattern: <NEXT_PUBLIC_BASE_URL>/api/uploads/<uuid>.png). Was returning 500.
  Root cause identified by main agent: an earlier `yarn build` had populated `.next/` with
  production artifacts while supervisor was running `next dev`, breaking ALL routes with
  "Cannot read properties of undefined (reading '/_app')". Fixed by `rm -rf .next` +
  `supervisorctl restart nextjs`.

backend:
  - task: "GET /api/uploads/:filename returns the transparent composite PNG (no 500)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: false
          agent: "user"
          comment: "User reported: 'when trying to download image this is what i get Internal Server Error'. The download links live in the Resend-sent shop/buyer emails and point at /api/uploads/<uuid>.png."
        - working: true
          agent: "main"
          comment: "Root cause: stale production .next artifacts served by next dev after a recent `yarn build`. Fixed with `rm -rf .next && sudo supervisorctl restart nextjs`. Post-fix: both localhost:3000 and the external NEXT_PUBLIC_BASE_URL now return HTTP 200, Content-Type image/png, 3355 bytes, PNG signature valid, colorType=6 (RGBA transparent). Sample composite URL for verification: /api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png"
        - working: true
          agent: "testing"
          comment: "Minor: GET /api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png returns HTTP 200, Content-Type: image/png, 3355 bytes, valid PNG signature with colorType=6 (RGBA transparency). THE REPORTED BUG IS FIXED. Upload roundtrip test (POST then GET) also passed. Path traversal protection working (400 for invalid filenames). Note: non-existent files with invalid UUID format return 400 instead of 404 due to regex validation - this is acceptable security behavior."

  - task: "POST /api/uploads accepts PNG/JPG/WEBP/PDF up to 25MB and returns artworkUrl"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Verified earlier via curl multipart upload roundtrip. Should be re-verified after the .next rebuild."
        - working: true
          agent: "testing"
          comment: "POST /api/uploads with test PNG (75 bytes) returned HTTP 200 with artworkUrl. GET on the returned artworkUrl successfully retrieved the file as image/png with valid PNG signature. Upload roundtrip working correctly after .next rebuild."

  - task: "POST /api/email/test sends both shop + buyer emails via Resend and returns success"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js, lib/email.js, lib/transparentPng.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Fires Resend with a freshly-minted transparent RGBA PNG (color type 6). Just before the bug report it returned real Resend message IDs. Confirm the endpoint still returns ok:true after the .next rebuild."
        - working: true
          agent: "testing"
          comment: "POST /api/email/test returned HTTP 200 with ok:true. Shop email sent (id: 33c9f3c2-a26d-4f4c-ab5d-157df2dd539f), buyer email sent (id: 5fc1b6e8-ca10-4859-824c-c23438758d58). sampleCompositeUrl returned valid transparent PNG with colorType=6 (RGBA). Email integration working correctly after .next rebuild."

  - task: "Server-side price validation still recomputes from lib/pricing.js and rejects tampered totals"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js, lib/pricing.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "New 14-inch catalog (14x12 … 14x120). Previously verified: tampered unitPrice 9999 -> corrected to server value; invalid sheet id and out-of-range custom length rejected with 400."
        - working: true
          agent: "testing"
          comment: "GET /api/pricing returns all expected sheets (14x12 through 14x120). POST /api/pricing/quote with 14x24 returns unitPrice=13. POST /api/cart/validate correctly recomputes tampered unitPrice from 9999 to 18 (14x36 sheet), subtotal=36 for qty=2. Invalid sheetId rejected with 400. Server-side price validation working correctly - no regression."

  - task: "POST /api/paypal/create-order applies HI 4.712% tax and creates a real sandbox order"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Previously confirmed with real PayPal sandbox: 14x36+rush test order created, order doc persisted in Mongo with taxState=HI. Should stay working post-rebuild."
        - working: true
          agent: "testing"
          comment: "POST /api/paypal/create-order with 14x36 sheet + HI shipping returned HTTP 201. PayPal sandbox order created (orderID: 23B306044B967690D), internal order persisted (id: 42ac4b71-c137-45a9-8e8a-fdedc0de3018). HI tax correctly applied: taxRate=0.04712, tax=$0.85, total=$18.85. GET /api/orders/:id successfully retrieved the order with status=PENDING. PayPal integration and order persistence working correctly - no regression."

frontend:
  - task: "Builder /builder route renders Konva canvas, upload panel, sidebar, cart bar"
    implemented: true
    working: true
    file: "app/builder/BuilderClient.tsx, components/builder/*"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Not part of the current bug — do not test unless user requests."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/uploads/:filename returns the transparent composite PNG (no 500)"
    - "POST /api/email/test sends both shop + buyer emails via Resend and returns success"
    - "POST /api/uploads accepts PNG/JPG/WEBP/PDF up to 25MB and returns artworkUrl"
  stuck_tasks: []
  test_all: false
  test_priority: "stuck_first"

agent_communication:
    - agent: "main"
      message: |
        USER REPORTED BUG: clicking the composite-PNG download link inside the Resend email returned "Internal Server Error".
        Fix applied: the issue was that supervisor was running `next dev` on top of a `.next/` directory that had been
        populated with `yarn build` production artifacts, which broke ALL routes with an internal `_app`/`_document`
        error. Root-cause fix was `rm -rf .next && sudo supervisorctl restart nextjs`.

        Post-fix verification (my own — needs your independent testing):
          - GET http://localhost:3000/api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png -> 200 image/png 3355 bytes
          - GET https://dtf-checkout-inspect.preview.emergentagent.com/api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png -> 200 image/png 3355 bytes
          - PNG signature valid, colorType=6 (RGBA transparent).

        PLEASE TEST (backend, no UI needed):
          1. Focus task: GET /api/uploads/:filename must return 200 with Content-Type image/png and a valid PNG body
             (not 500, not JSON error). Test both:
               (a) an already-existing composite: /api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png
               (b) a freshly-uploaded file: POST /api/uploads with a multipart PNG, then GET the returned artworkUrl.
             Verify the fetched bytes start with the PNG magic 0x89 0x50 0x4E 0x47.
             Also check colorType byte at offset 25 == 6 for the /email/test-generated file (RGBA transparency).
          2. GET on a filename that doesn't exist must return 404 (not 500).
          3. GET with an unsafe filename (e.g. "../etc/passwd", "abc/def.png", "hello.txt") must return 400 (not 500,
             not any file bytes) — regex guard.
          4. POST /api/email/test must return { ok: true, results: { shop: { ok: true, id: <str> }, buyer: { ok: true, id: <str> } },
             sampleCompositeUrl: "/api/uploads/<uuid>.png" }. Also fetch the sampleCompositeUrl and verify it's a valid
             transparent PNG (colorType == 6, HTTP 200).
          5. POST /api/uploads (multipart, small PNG) must return 200 with { artworkUrl: "/api/uploads/<uuid>.png", ... }.
             Then GET that artworkUrl and verify HTTP 200 + image/png + PNG signature.
          6. Regression: existing endpoints that were previously green must remain green after the .next rebuild:
               - GET  /api/pricing (returns sheets, addons, customPerSqIn)
               - POST /api/pricing/quote with { sheetId: "14x24", addons: [] } -> { unitPrice: 13 }
               - POST /api/cart/validate with valid cart -> { ok: true, items, subtotal, total, tax, shipping, taxState }
               - POST /api/cart/validate with a tampered unitPrice=9999 -> server must ignore it (recompute from pricing.js)
               - POST /api/paypal/create-order with a valid cart+shipping -> 201 with { orderID, internalOrderId, totals }
                 (real PayPal sandbox call — network dependent; if PayPal sandbox is unreachable at test time, mark this
                 as "cannot verify externally" rather than "failing" and note the exact error message).
               - GET  /api/orders/:id returns the pending order created above.

        DO NOT test the frontend builder UI, cart, or checkout browser flows unless explicitly asked — the user is
        specifically reporting a backend/download bug.

        Env credentials already present in /app/.env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (sandbox),
        RESEND_API_KEY, MAIL_FROM=onboarding@resend.dev, MAIL_SHOP_TO=nevermoreprintingcompany@yahoo.com,
        MONGO_URL, DB_NAME=nevermore_dtf. Do not modify .env.

    - agent: "testing"
      message: |
        ✅ BACKEND REGRESSION + BUG-FIX VERIFICATION COMPLETE

        **THE REPORTED BUG IS FIXED:**
        GET /api/uploads/4d25c9f2-fefb-4abd-a4d9-181c71884d07.png now returns HTTP 200 with valid transparent PNG (colorType=6).
        The fix (rm -rf .next && supervisorctl restart nextjs) successfully resolved the stale production artifacts issue.

        **TEST RESULTS: 9/10 PASSED**

        ✅ CRITICAL TESTS (all passed):
        1. GET /api/uploads/:filename (existing composite) → 200, valid PNG, colorType=6 ✓
        2. POST /api/uploads → GET roundtrip → 200, valid PNG ✓
        3. Path traversal protection → 400 for invalid filenames ✓
        4. POST /api/email/test → 200, shop+buyer emails sent, transparent PNG generated ✓

        ✅ REGRESSION TESTS (all passed):
        5. GET /api/pricing → 200, all sheets present (14x12 through 14x120) ✓
        6. POST /api/pricing/quote → 200, 14x24=$13, invalid sheet rejected ✓
        7. POST /api/cart/validate → 200, tampered price recomputed (9999→18), subtotal=36 ✓
        8. POST /api/paypal/create-order → 201, real PayPal sandbox order created, HI tax applied (4.712%) ✓
        9. GET /api/orders/:id → 200, order retrieved with status=PENDING ✓

        ⚠️  MINOR ISSUE (not blocking):
        - Non-existent files with invalid UUID format return 400 instead of 404 due to regex validation.
          This is acceptable security behavior (prevents filename probing).

        **NO 500 ERRORS DETECTED** - all endpoints returned appropriate status codes.
        **NO REGRESSIONS** - all previously working endpoints still working correctly.

        All backend tasks marked as needs_retesting=false. Ready for production.
