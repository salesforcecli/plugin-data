# summary

Execute a SOQL query.

# description

Specify the SOQL query at the command line with the --query flag or read the query from a file with the --file flag.

If your query returns more than 10,000 records, specify the --bulk flag. The command then runs the query using Bulk API 2.0, which has higher limits than the default API used by the command.

When using --bulk, the command waits 3 minutes by default for the query to complete. Use the --wait parameter to specify a different number of minutes to wait, or set --wait to 0 to immediately return control to the terminal. If you set --wait to 0, or you use the --async flag, or the command simply times out, the command displays an ID. Pass this ID to the the "data query resume" command using the --bulk-query-id flag to get the results; pass the ID to the "data resume" command to get the job status.

# examples

- Specify a SOQL query at the command line; the command uses your default org:

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact"

- Read the SOQL query from a file called "query.txt"; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --file query.txt --target-org my-scratch

- Use Tooling API to run a query on the ApexTrigger Tooling API object:

  <%= config.bin %> <%= command.id %> --query "SELECT Name FROM ApexTrigger" --use-tooling-api

- Use Bulk API 2.0 to run a query that returns many rows, and return control to the terminal immediately:

  <%= config.bin %> <%= command.id %> --query "SELECT Id FROM Contact" --bulk --wait 0

# flags.query.summary

SOQL query to execute.

# flags.use-tooling-api.summary

Use Tooling API so you can run queries on Tooling API objects.

# flags.file.summary

File that contains the SOQL query.

# flags.bulk.summary

Use Bulk API 2.0 to run the query.

# flags.async.summary

Use Bulk API 2.0, but don't wait for the job to complete.

# flags.all-rows.summary

Include deleted records. By default, deleted records are not returned.

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryRunningMessage

Querying Data

# bulkQueryTimeout

Query ID: %s
Query is in progress.

Run "sf data query resume -i %s -o %s" to get the latest status and results.
