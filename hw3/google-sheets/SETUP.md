# Google Sheets setup

## Spreadsheet (pre-configured in workflow)

| Field | Value |
|-------|--------|
| **Link** | https://docs.google.com/spreadsheets/d/1039zHFjCtQtrnEgMc5bQ2wpKAJw-SABn5X9v4So_HKA/edit?usp=sharing |
| **Sheet ID** (n8n) | `1039zHFjCtQtrnEgMc5bQ2wpKAJw-SABn5X9v4So_HKA` |
| **Tab name** | `Sheet1` (you may rename to `TravelRequests` — update all n8n nodes to match) |

## Exact column headers (row 1)

Copy this header row exactly:

```
ID | CityOrCountry | UserEmail | Status | GeneratedHTML | GitHubHTMLLink | GitHubJSONBackupLink | MapLink | Attractions | Coordinates | UserComment | Version | CreatedAt | UpdatedAt
```

| Column | Header | Who fills | Purpose |
|--------|--------|-----------|---------|
| A | ID | User / formula | Unique row id (`=ROW()-1` or manual) |
| B | CityOrCountry | **User** | City or country to generate (e.g. `Prague, Czech Republic`) |
| C | UserEmail | **User** | Email for approval messages |
| D | Status | User + workflow | `Pending` triggers run; workflow sets `Generating`, `AwaitingApproval`, `Approved`, `Regenerating`, `Error` |
| E | GeneratedHTML | Workflow | Raw GitHub URL of approved HTML page |
| F | GitHubHTMLLink | Workflow | Link to HTML file commit on GitHub |
| G | GitHubJSONBackupLink | Workflow | Link to JSON backup commit on GitHub |
| H | MapLink | Workflow | OpenStreetMap link used in the page |
| I | Attractions | Workflow | JSON array of attraction names (for grading) |
| J | Coordinates | Workflow | JSON array of `{ name, latitude, longitude }` |
| K | UserComment | User via email | Rejection comment from Gmail form |
| L | Version | User + workflow | Starts at `1`; increments on each rejection |
| M | CreatedAt | Workflow | ISO timestamp of first run |
| N | UpdatedAt | Workflow | ISO timestamp of last change |

## Example test row

| ID | CityOrCountry | UserEmail | Status | Version |
|----|---------------|-----------|--------|---------|
| 1 | Kyoto, Japan | your.email@gmail.com | Pending | 1 |

Leave columns E–K and M–N empty until the workflow fills them.

## Trigger a run

1. Set `Status` to **`Pending`** (exact spelling, no spaces).
2. Fill `CityOrCountry` and `UserEmail`.
3. Set `Version` to `1`.
4. Activate the n8n workflow and wait ~1 minute for the poll, or execute manually in n8n.

## Data validation (recommended)

- **Status** dropdown: `Pending`, `Generating`, `AwaitingApproval`, `Approved`, `Regenerating`, `Error`
- **Version** number ≥ 1

## n8n connection

1. **Credentials** → Google Sheets OAuth2 → connect your Google account.
2. In each Google Sheets node, confirm document ID above and sheet **`Sheet1`**.
3. Share the sheet with the course checker (Viewer or Editor).
