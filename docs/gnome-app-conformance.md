# GNOME app visual conformance

The machine-readable source of truth is
[`tests/fixtures/gnome-app-catalog.json`](../tests/fixtures/gnome-app-catalog.json).
An app is **passed** only after its isolated native Broadway image, isolated
Protota image, and generated diff have all been visually inspected. A passing
test alone is not enough.

| State | Apps |
| --- | --- |
| Passed | None yet |
| Needs tuning | Amberol — native/Protota surfaces inspected; StatusPage centering and action layout are being tuned generically. |
| Not yet validated | Calculator, Calendar, Clocks, Disks, Files, Settings, Software, Text Editor, Weather, Web |
| Next native capture | Authenticator (GNOME Circle) — Broadway image built on `himachal`; preset still to be created. |

## Required sequence

1. Add the app and its source/launch metadata to the catalogue.
2. Capture the real GTK app with Broadway on `himachal`.
3. Add a generic-widget-only preset.
4. Run the paired capture, inspect native, Protota, and diff images.
5. Set `visualStatus` to `passed` only when the inspection is acceptable and a
   calibrated difference threshold can be enforced.
