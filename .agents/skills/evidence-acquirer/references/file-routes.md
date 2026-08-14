# File-family extraction routes

Choose by detected content, not extension alone. Preserve all raw outputs and
record tool/version details in analysis diagnostics.

## PDF

Extract metadata and embedded text, determine page count, then render and inspect
every relevant page. OCR pages with no usable text or coordinate/map imagery.
Record page plus table, paragraph, or image-region locators.

## Images and scans

Preserve EXIF metadata separately, inspect orientation and resolution, and OCR
without overwriting the original. Record image-region/bounding-box locators.
Treat EXIF GPS as metadata requiring review, not parcel geometry.

## Word-processing documents

Extract paragraphs, headers, footers, footnotes, tables, comments/changes when
available, relationships, and embedded images. OCR relevant embedded scans.

## Spreadsheets

Inventory every sheet and hidden state. Extract displayed values and formulas,
merged ranges, named ranges, charts/images, and cell coordinates. Preserve
leading zeros and distinguish calculated values from literal source values.

## Delimited and plain text

Detect encoding, delimiter, headers, quoting, and decimal conventions. Preserve
line numbers and row/column locators. Do not coerce ambiguous numeric strings.

## Native geospatial

Inventory layers, feature counts, geometry types, CRS definitions, extents,
attributes, metadata, and required sidecars. Preserve the dataset as a bundle.
Never assume WGS84 when CRS metadata is absent. Do not use dataset extent as an
asset boundary.

## HTML

Preserve the retrieved HTML and final URL. Extract visible text, tables,
structured data, attachment URLs, embedded map configuration, service URLs, and
download links. A viewer or portal is not the underlying dataset.

## Archives

List members before extraction. Reject absolute paths, `..` traversal, devices,
links escaping the workspace, excessive nesting, encryption without approved
credentials, and suspicious expansion ratios. Preserve the original archive;
route relevant members recursively and use full archive-member locators.

## Mismatches and unsupported content

Record declared/detected-type mismatches. Quarantine executables or malformed
content. For an unsupported but safe format, preserve and inventory it, set a
clear diagnostic, and recommend human review rather than guessing.
