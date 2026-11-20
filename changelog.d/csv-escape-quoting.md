### Security

- **CSV export quotes semicolons and carriage returns.** Cells containing `;` or a bare CR are now wrapped in quotes, so a spreadsheet in a semicolon locale cannot split a note into extra cells. Multi-value cells such as `Cycle factors` are now always quoted.
