# summary

Bulk export records from an org.

# description

Specify a SOQL query to export fields of an object and get them in CSV or JSON format.

Use this command to export thousands of records from an org, either to migrate data or backup.

NOTE:
This command uses the `Bulk API 2.0` which doesn't support SOQL queries including any of these items:

- GROUP BY, LIMIT, ORDER BY, OFFSET, or TYPEOF clauses.
- Aggregate Functions such as COUNT().
- Date functions in GROUP BY clauses. (Date functions in WHERE clauses are supported.)
- Compound address fields or compound geolocation fields. (Instead, query the individual components of compound fields.)
- Parent-to-child relationship queries. (Child-to-parent relationship queries are supported.)

Don’t use ORDER BY or LIMIT, as they disable PKChunking for the query. With PKChunking disabled, the query takes longer to execute, and potentially results in query timeouts. If ORDER BY or LIMIT is used, and you experience query time outs, then remove the ORDER BY or LIMIT clause before any subsequent troubleshooting.

# examples

- Export `Id`, `Name` and `BillingAddress` fields of the `Account` object as CSV:

  sf <%= command.id %> -q "SELECT Id, Name, FROM Contact" --output-file export-accounts.csv --wait 10

- Export as JSON:

  sf <%= command.id %> -q "SELECT Id, Name, FROM Contact" --output-file export-accounts.csv --result-format json --wait 10

- Export asynchronously (can be resumed later via `sf export bulk resume -i <job-id>`):

  sf <%= command.id %> -q "SELECT Id, Name, FROM Contact" --output-file export-accounts.csv --result-format json --async

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# flags.async.summary

Don't wait for the job to complete.

# flags.query.summary

SOQL query to execute.

# flags.all-rows.summary

Include deleted records. By default, deleted records are not returned.

# flags.output-file.summary

File where records will be saved.

# flags.result-format.summary

Format to display the results.

# flags.column-delimiter.summary

Column delimiter to be used when writing CSV output.

# flags.line-ending.summary

Line ending to be used when writing CSV output.

# flags.query-file.summary

File that contains the SOQL query.

# export.timeout

Run "sf data export resume -i %s" to get the latest status and results.
