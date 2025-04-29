# summary

Execute a SOQL query.

# description

Specify the SOQL query at the command line with the --query flag or read the query from a file with the --file flag.

If your query returns more than 10,000 records, prefer to use the `sf data export bulk` command instead. It runs the query using Bulk API 2.0, which has higher limits than the default API used by the command.

# examples

- Specify a SOQL query at the command line; the command uses your default org:

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact"

- Read the SOQL query from a file called "query.txt" and write the CSV-formatted output to a file; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --file query.txt --output-file output.csv --result-format csv --target-org my-scratch

- Use Tooling API to run a query on the ApexTrigger Tooling API object:

  <%= config.bin %> <%= command.id %> --query "SELECT Name FROM ApexTrigger" --use-tooling-api

# flags.query.summary

SOQL query to execute.

# flags.use-tooling-api.summary

Use Tooling API so you can run queries on Tooling API objects.

# flags.file.summary

File that contains the SOQL query.

# flags.all-rows.summary

Include deleted records. By default, deleted records are not returned.

# flags.output-file.summary

File where records are written; only CSV and JSON output formats are supported.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryRunningMessage

Querying Data
