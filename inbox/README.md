# inbox/

Drop product poster images here (portrait, 1536×2048), then ask Claude to
add them — or run `/add-products`. Claude reads each poster, extracts the
product data (name, brand, category, compatibility, features), uploads the
image to Directus and creates the product as a draft for review.

Processed images are moved to `inbox/done/`.

Images in this folder are gitignored; only this README is committed.
