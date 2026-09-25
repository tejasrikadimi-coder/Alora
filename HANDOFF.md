# Checkout Fix Handoff

## Completed changes

- Firestore order saving remains mandatory before success UI, local history, cart cleanup, or navigation.
- After Firestore resolves successfully, `placeOrderCompleted` is set immediately and blocks further `placeOrder()` calls during the navigation window.
- The Google Form submission is now secondary and non-blocking. Its rejection is handled without changing the successful order state.
- Firestore failures still reset the button and in-flight guard, preserving retry behavior.

## Validation

An isolated Node mock test loaded the actual `script.js` and `checkout-profile.js` functions with mocked DOM, storage, Firebase writes, fetch, timers, alerts, and navigation. It covered Firestore failure/retry, hanging and rejected Google Form requests, duplicate calls, cart checkout, and direct Buy Now payloads.

## Remaining limitations

- A Firestore write followed by a browser crash or reload can still make a retry create a duplicate order; this frontend guard is not an exactly-once mechanism.
- `no-cors` Google Form requests are not verifiable from browser JavaScript.
- Local history and cart cleanup remain secondary browser-storage effects.

## Customer cancellation flow

- Customer cancellation now uses the existing request modal and creates only the nested `cancel` request with a reason, `Requested` status, and ISO timestamp.
- Direct customer order and product updates for cancellation were removed from the active flow.
- Existing requests are shown with their stored status, duplicate submissions are guarded, and only `Order Received` or `Confirmed` orders can submit cancellation requests.
- Admin approval and its existing stock restoration checks were not changed.

## Firestore rules emulator verification

- Emulator rules tests were **not tested** in this task.
- `firebase` CLI 15.25.1, Java 25, Node 24.19.0, and npm 11.17.0 are available locally.
- No root `package.json` or rules-test suite exists. The only package manifest is `functions/package.json`, which has no Firestore rules test runner.
- The Firestore Emulator binary/cache is missing from the checked local Firebase cache paths. Starting the emulator would require downloading the missing binary, which was not performed.
- No emulator, production Firebase project, deployment, or live data was accessed.

## Firestore rules emulator test results

- Added isolated tests under `tests/firestore/` with their own `package.json`.
- Installed `firebase@10.14.1` and `@firebase/rules-unit-testing@3.0.4` only in that folder. Website dependencies were not changed.
- Downloaded and ran the official Firestore Emulator on `127.0.0.1:8080` using demo project ID `demo-alora-rules`.
- The isolated `tests/firestore/firestore.rules` fixture matched the current root rules file by SHA-256 before testing.
- Rerun command:

  `cd tests/firestore && npm test`

- Final result: **exit code 0**. All requested cases passed:
  - anonymous product read and protected-write/profile/order denial
  - customer profile creation, editable-field updates, and role-escalation denial
  - cross-user profile/order denial
  - valid checkout order creation
  - forged user ID, status, payment status, and stock flags denied
  - customer order/product mutation denied
  - valid cancellation, overwrite denial, and ineligible cancellation denial
  - valid delivered return/exchange requests
  - admin collection-group order query and admin product/order/request updates

These results verify the loaded rules in the local emulator only. Production rules, deployed configuration, and live data remain unverified.

### Complete emulator rerun procedure

From the project root, use two terminals:

1. Synchronize the emulator fixture from the current root rules and start the local emulator:

   `cd tests/firestore && npm run sync-rules && npm run emulator`

2. In a second terminal, run the rules tests:

   `cd tests/firestore && npm test`

`npm test` synchronizes `tests/firestore/firestore.rules` from the current root `firestore.rules` before running, but it does not start the emulator. If the emulator is not already running at `127.0.0.1:8080`, the test run will fail to connect. Restart the emulator after any rules change so it loads the newly synchronized file.

The exact Firestore-only deployment command, not executed during this review, is:

`firebase deploy --only firestore:rules --project alora-handmade-jewelry`

This command targets the configured project and must not be run without separate approval. Production behavior and the live admin profile remain unverified.

## Direct admin order links

- Admin order cards now use a stable DOM ID derived from the existing `userId__orderId` key.
- After admin authentication, admin verification, and order loading, `admin.html?orderId=...&userId=...` finds the exact entry in `ordersByKey`, renders it even when filters would hide it, scrolls to it, and applies a temporary highlight.
- Invalid or inaccessible query parameters show `Order not found or you do not have access to it.` without changing authorization. Firestore admin permissions remain the access control.
- Focused regression coverage is in `tests/admin-direct-order-link.test.js`.
- After a successful customer Firestore order save, `placeOrder()` builds an absolute admin order URL locally from the saved order ID and authenticated customer UID. It is not displayed or used for navigation yet; it is reserved for the later WhatsApp notification step.
- URL-generation coverage is in `tests/admin-order-link-generation.test.js`.

## Server-side WhatsApp order notification preparation

- Added the Gen 2 `notifyAdminNewOrder` Firestore trigger in `functions/index.js` for `users/{userId}/orders/{orderId}`.
- It builds the admin URL server-side and sends a text payload through the Meta WhatsApp Cloud API using `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_NUMBER`, and `ALORA_SITE_URL` Secret Manager references.
- Successful sends are recorded in `orderNotifications/{userId_orderId}` so later delivery retries skip already-sent orders. Failed sends throw after concise logging so Functions retry behavior can run without changing the saved order.
- Helper/API mock coverage is in `functions/whatsapp.test.js`; no credentials were configured and no deployment was performed.

## Permanent product URLs

- Product cards now generate `product.html?id=PRODUCT_ID` using the stable Firestore document ID.
- `product.html` fetches `products/{id}` from Firestore and treats its name, price, image, stock, description, and active state as authoritative.
- Product-page Wishlist, Add to Cart, Buy Now, and Share actions use the loaded product state. Legacy URLs with copied fields remain supported only when no ID is present; an ID always takes precedence.
- Sharing uses an absolute canonical URL and the Web Share API when available, with a clipboard fallback.
- Focused coverage is in `tests/product-page.test.js`.

## Firestore rules deployment

- Before deployment, the root and tested rules hashes matched exactly:
  `DBE962DF533C500D5DFE37C320966AF8568A96F3A0859A37AE0F5C422040938E`
- Executed from the Alora project root:

  `firebase deploy --only firestore:rules --project alora-handmade-jewelry`

- Result: **successful**. Firebase reported that `firestore.rules` compiled successfully and was released to Cloud Firestore.
- Hosting, functions, and indexes were not deployed. No database documents were modified.
- The live admin profile is reported to have `role: "admin"`; no live application flows were tested.

## Wishlist price correction

- Cause: `script.js` previously replaced wishlist prices from localStorage with the hardcoded `products` array, and otherwise fell back to the old stored price. Wishlist rendering did not read Firestore.
- `script.js` now resolves wishlist items against the current Firestore `products` documents. Document IDs are preferred; legacy name-only entries are used only when exactly one active product has that name.
- Missing or ambiguous products render as unavailable and disable purchase actions without clearing localStorage or inventing a price.
- `products.js` now stores the Firestore product ID in newly saved wishlist entries.
- Isolated test result: `tests/wishlist-price.test.js` passed, confirming an old `₹799` wishlist value updates to current Firestore price `₹1299`, and both Buy Now/Add to Cart receive `1299`.

## Forgot Password

- Completed the existing `forgotPasswordButton` flow in `auth.js` using the existing Firebase 12.2.1 `sendPasswordResetEmail` import.
- It reads only `loginEmail`, validates without requiring the password, uses a non-enumerating success message, prevents duplicate clicks, and maps invalid-email, network, and rate-limit errors before re-enabling the button.
- `loginMessage` is now an accessible live status region in `login.html`.
- Syntax checks passed for `auth.js` and `tests/forgot-password.test.js`.
- Isolated mock results:
  - PASS valid submission
  - PASS invalid email without password
  - PASS duplicate click while sending
  - PASS API failure re-enables button
- Manual test still needed: in a non-production test account, submit a reset request and confirm the default Firebase reset email/link flow in the inbox and spam folder. No email was sent during automated tests.

## Account-specific wishlist and cart

- Signed-out visitors continue using `aloraWishlist` and `aloraCart` in localStorage.
- Authenticated users use owner-scoped Firestore documents:
  - `users/{uid}/wishlist/{productId}` with `productId` and `createdAt`
  - `users/{uid}/cart/{productId}` with `productId`, positive integer `quantity`, and `updatedAt`
- Current product name, image, price, active state, and stock are resolved from the Firestore `products` collection. Legacy name-only entries migrate only when exactly one active product matches.
- Guest data is cleared only after the merged wishlist/cart state is successfully written. A larger existing remote cart quantity is preserved over a smaller guest quantity.
- Authentication changes clear in-memory account state before loading the next account, so account data is not shared across logout or account switching.
- Local rules add owner-only wishlist/cart reads and writes; admins are not granted access to these collections.
- Account cart checkout now resolves current product data before staging `aloraCheckoutCart`, preventing ID-only account entries from producing stale or missing checkout totals.

### Account storage validation

From the project root:

`node tests/account-storage.test.js`

Result: **exit code 0**. The isolated mock test loaded actual storage functions and passed:

- unambiguous guest migration to stable product IDs while dropping missing entries
- account A cart isolation
- account switching replacing account A state with account B state

Rules tests use the current root rules and require the local emulator:

`cd tests/firestore && npm test`

Result: **exit code 0**. The emulator suite passed owner, cross-user, anonymous, and invalid cart quantity cases in addition to the existing profile, order, request, product, and admin cases. The new wishlist/cart rules have **not** been deployed; production behavior remains unverified.

Remaining manual verification: sign in with two synthetic customer accounts in a local/browser environment, verify guest migration and logout/account switching, exercise current-price wishlist/cart rendering, and test unavailable or stock-limited products. Offline retry UI and rapid auth-switch rendering also remain browser-level checks.

### Account wishlist/cart rules deployment

- Re-ran `cd tests/firestore && npm test` against the local Firestore Emulator.
- Result: **exit code 0**; all rules checks passed.
- Verified SHA-256 hashes before deployment:
  - Root `firestore.rules`: `80C9AC5583312340B76C5DC14B27518F879A73BE950AA15A840024E52FA3A8B9`
  - `tests/firestore/firestore.rules`: `80C9AC5583312340B76C5DC14B27518F879A73BE950AA15A840024E52FA3A8B9`
- Confirmed `.firebaserc` default project is `alora-handmade-jewelry`.
- Executed only:

  `firebase deploy --only firestore:rules --project alora-handmade-jewelry`

- Deployment succeeded. Firebase reported that `firestore.rules` compiled successfully and was released to Cloud Firestore.
- Hosting, functions, indexes, and production documents were not modified. Live application flows remain unverified.

## Account wishlist/cart runtime scope fix

- Root cause: `toggleMenu()`, `persistAccountState()`, and `showAccountDataError()` each lacked a closing brace. The resulting scope errors made `getAccountItems` and `initializeAccountPersistence` inaccessible at runtime despite earlier extracted-function checks.
- `renderCart()` now hides the empty-cart panel and summary while account data is unavailable, preventing a synchronization failure from showing a misleading “Your Cart is Empty” state.
- Added `tests/account-runtime.test.js`, which executes the complete actual `script.js` with mocked Firebase dynamic imports and DOM events.
- Regression command:

  `node --experimental-vm-modules tests/account-runtime.test.js`

- Result: **exit code 0**. Authenticated initialization, account switching isolation, and account-load failure rendering all passed. The Node experimental VM-modules warning is expected for this harness.
- No Firestore rules were changed or deployed. Browser testing over Live Server remains pending.

## Contact messages and admin inbox

- The contact form in `contact.html` now requires an authenticated Firebase user. Signed-out visitors receive a login prompt while the direct WhatsApp, phone, and email links remain available.
- Valid submissions are saved to `contactMessages/{messageId}` with `userId`, `name`, `email`, `subject`, `message`, `status: "New"`, and Firestore `serverTimestamp()` in `createdAt`.
- UI and rules enforce limits of 100 characters for names, 254 for email, 150 for subjects, and 2000 for messages. The form disables its submit button while saving, resets only after Firestore confirms success, and preserves input on failure.
- The admin dashboard now loads a Messages section for verified admins. It renders sender details, subject, message text, timestamp, and status safely with DOM `textContent`, and permits only `New` -> `Read` updates.
- No email or WhatsApp messages are sent automatically.
- Root `firestore.rules` now permits authenticated owner-created messages with exact fields and `createdAt == request.time`, admin-only reads, admin-only `New` -> `Read` updates, and no deletes. Anonymous writes and customer reads/updates remain denied.

Validation:

- Website/admin/contact JavaScript syntax checks passed.
- `node tests/contact-form.test.js` exited `0`:
  - successful save
  - failed save preserves input
  - duplicate submission blocked
  - signed-out login prompt
- `cd tests/firestore && npm test` exited `0` against the local emulator:
  - valid creation
  - anonymous creation denial
  - cross-user spoofing denial
  - customer read/update denial
  - admin read/list and status update
  - admin field-change denial
  - invalid-length denial
- Rules were not deployed. Manual browser verification with an authenticated customer and admin remains pending.

## Authenticated cart cleanup after checkout

- Root cause: cart checkout staged `aloraCheckoutCart`, but after Firestore order saving `placeOrder()` only removed the guest `aloraCart` localStorage key. Authenticated `users/{uid}/cart/{productId}` documents were never decremented, so they reappeared after reload or login.
- After a successful Firestore order save, authenticated cart checkout now reads the current account cart and subtracts only the staged stable product IDs and quantities. Unrelated products and quantities added after staging remain.
- Cleanup is bound to the account UID captured for the order, rejects account switching during cleanup, and records an account/order marker in localStorage to prevent repeat subtraction.
- Direct Buy Now does not invoke cart cleanup. Failed order saves leave checkout/cart data unchanged. If cleanup fails after the order save, the UI reports that the order was placed but cart cleanup failed rather than reporting an order failure.
- Guest checkout behavior remains unchanged.
- No rules, stock, payment logic, or deployed resources were changed.

Focused regression command:

`node --experimental-vm-modules tests/cart-cleanup.test.js`

Result: **exit code 0**:

- successful cart checkout removes purchased quantities
- successful cleanup remains cleared after account reload
- failed order save preserves checkout cart
- Buy Now preserves cart
- unrelated and newly added quantities survive
- repeated cleanup does not subtract twice
- cleanup failure leaves cart unchanged
- cleanup failure after order save does not turn the saved order into a failed order
