# Alora Handmade Jewelry

**Live Website:** https://alora-handmade-jewelry.web.app

Alora Handmade Jewelry is a website for showcasing and selling handmade jewellery online. Customers can explore jewellery collections, view product details, save favourites, add products to their cart, and place orders.

The project was built to make it easier for customers to discover Alora
products online and to help the store owner manage products and orders
in one place.

## What the website includes

-   Homepage with featured jewellery, search, and links to collections
-   Collections and individual product pages
-   Customer sign-up and login
-   Customer profile and order history
-   Wishlist and shopping cart
-   Checkout and order placement
-   Admin dashboard for store management
-   Contact page, FAQ, Terms & Conditions, and Privacy Policy
-   WhatsApp contact link and order-notification integration code
-   Firebase Hosting for publishing the website

Some integrations need valid credentials and configuration before they
can work in a live environment. In particular, email and WhatsApp
notifications should be tested with the real service settings before
relying on them for customer orders.

## How it works

1.  A customer opens the website and browses the available jewellery.
2.  The customer can search products, open a product page, and add an
    item to the cart or wishlist.
3.  When the customer places an order, the website saves the order in
    Cloud Firestore.
4.  Signed-in customers can view their profile and their orders.
5.  The admin area is used to review and manage store products and
    orders.
6.  Firebase Cloud Functions can handle server-side tasks such as
    order-notification workflows.
7.  Firebase Hosting serves the website to visitors.

The website is mainly built with HTML, CSS, and JavaScript. Firebase
provides the hosted backend services, so the project does not need a
separately maintained Express server for its core authentication and
database features.

## Technologies used

-   **HTML** --- defines the structure and content of each page.
-   **CSS** --- controls the layout, colours, typography, and responsive
    design.
-   **JavaScript** --- adds behaviour such as product display, search,
    cart, wishlist, account flows, and checkout.
-   **Firebase Authentication** --- manages customer sign-in and
    authentication flows.
-   **Cloud Firestore** --- stores application data such as products,
    customer information, and orders.
-   **Firebase Cloud Functions** --- runs server-side tasks, including
    the order-notification workflow.
-   **Firebase Hosting** --- publishes the website online.
-   **EmailJS / email integration code** --- supports the
    email-notification setup; live delivery depends on correct service
    IDs, templates, keys, and account limits.
-   **WhatsApp Cloud API integration code** --- prepares an admin order
    notification workflow; valid Meta credentials and deployment are
    required for live sending.
-   **Google Fonts** --- provides the Cinzel and Poppins fonts used by
    the design.

## Main files and folders

  -----------------------------------------------------------------------
  File or folder                      Purpose
  ----------------------------------- -----------------------------------
  `index.html`                        Main homepage

  `collections.html`                  Product collections and category
                                      browsing

  `product.html`                      Individual product details

  `cart.html`                         Shopping cart

  `wishlist.html`                     Saved/favourite products

  `order.html`                        Checkout and order placement page

  `login.html`                        Sign-in and account access

  `profile.html`                      Customer profile

  `my-orders.html`                    Customer order history

  `admin.html`                        Admin dashboard

  `about.html`                        About the brand

  `contact.html`                      Contact page

  `faq.html`                          Frequently asked questions

  `terms.html`                        Terms, shipping, returns, and
                                      related policies

  `privacy-policy.html`               Privacy policy

  `style.css`                         Shared website styling

  `script.js`                         Shared website behaviour

  `products.js`                       Product display and related
                                      product-page interactions

  `firebase.js`                       Firebase app and service setup

  `auth.js`                           Authentication-related logic

  `admin.js`                          Admin dashboard logic

  `profile.js`                        Customer profile logic

  `my-orders.js`                      Customer order-history logic

  `checkout-profile.js`               Checkout/profile-related helper
                                      logic

  `order-email.js`                    Browser-side email integration
                                      configuration and calls

  `functions/index.js`                Firebase Cloud Functions entry
                                      point

  `functions/email.js`                Email-related server-side helper
                                      code

  `functions/whatsapp.js`             WhatsApp notification helper code

  `firestore.rules`                   Rules controlling access to
                                      Firestore data

  `firestore.indexes.json`            Firestore index configuration

  `firebase.json`                     Firebase Hosting, Firestore, and
                                      Functions configuration

  `assets/`                           Logo and favicon files

  `images/`                           Product images

  `tests/`                            Automated tests for selected
                                      website flows and behaviour
  -----------------------------------------------------------------------

## Run the website locally

The website is made from static HTML, CSS, and JavaScript files. You can
open `index.html` directly for a basic preview, but Firebase features
may require a local web server and the correct Firebase configuration.

A convenient option is Visual Studio Code with the **Live Server**
extension:

1.  Open the project folder in VS Code.
2.  Start Live Server from `index.html`.
3.  Open the local URL shown by VS Code.
4.  Check that Firebase configuration and Authentication/Firestore
    settings match the intended Firebase project.

## Firebase setup and deployment

The project includes Firebase configuration files. Before deploying,
make sure you are signed in to the Firebase CLI and have selected the
correct Firebase project.

Install the Firebase CLI if it is not already installed:

``` bash
npm install -g firebase-tools
firebase login
```

From the project root, install the Cloud Functions dependencies:

``` bash
npm --prefix functions install
```

Run the Functions lint check:

``` bash
npm --prefix functions run lint
```

Deploying the website and backend changes affects the configured
Firebase project. Review the configuration and changes before running
deployment commands. For example:

``` bash
firebase deploy
```

Use the narrowest deployment command that matches the change when
appropriate, and do not deploy until the relevant configuration, rules,
and credentials have been checked.

## Security and maintenance notes

-   Never publish private keys, service-account JSON files, passwords,
    or secret tokens.
-   Firebase web configuration can be visible in a browser, but access
    must be protected with Authentication and correctly written
    Firestore Security Rules.
-   Review `firestore.rules` whenever database access or user roles
    change.
-   Keep email and WhatsApp credentials in the appropriate
    secret/configuration system, not in public source files.
-   Test order placement, admin permissions, cancellation requests, and
    notifications before using the website for real orders.
-   Keep a backup of important product and order data.
-   Remove copied folders, scratch files, and unnecessary dependencies
    from the Hosting public directory before deploying. The current
    `firebase.json` sets the Hosting public directory to the project
    root (`.`), so files in that directory may be published unless
    excluded by the Hosting ignore rules.
-   Free service plans have usage limits. Check Firebase, email-service,
    and messaging-service dashboards regularly.

## Project status

This repository contains the website source, Firebase configuration,
Cloud Functions code, and automated tests for selected features. The
presence of integration code or passing mock tests does not by itself
prove that live emails, WhatsApp messages, payment flows, or production
permissions are working. Test those flows with the actual service
configuration before relying on them.

## In short

Alora Handmade Jewelry is a jewellery shopping website built with HTML,
CSS, and JavaScript, using Firebase for authentication, database,
hosting, and server-side functions. Its purpose is to help customers
browse jewellery and place orders online, while giving the store owner
tools to manage the shop.
