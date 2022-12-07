# summary

Execute a SOQL query.

# description

Specify the SOQL query at the command line with the --query flag or read the query from a file with the --file flag.

If your query returns more than 10,000 records, specify the --bulk flag. The command then runs the query using Bulk API 2.0, which has higher limits than the default API used by the command.

When using --bulk, the command waits 3 minutes by default for the query to complete. Use the --wait parameter to specify a different number of minutes to wait, or set --wait to 0 to immediately return control to the terminal. If you don't wait for the command to complete, or you use the --async flag, the command displays an ID. Pass this ID to the the "data query resume" command using the --bulk-query-id flag to get the results; pass the ID to the "data resume" command to get the status.

# examples

- Specify a SOQL query at the command line; the command uses your default org:

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact"

- Read the SOQL query from a file called "query.txt":

  <%= config.bin %> <%= command.id %> --file query.txt

- Use the Tooling API rather than the Metadata API to run the query:

  <%= config.bin %> <%= command.id %> --query "SELECT Name FROM ApexTrigger" --use-tooling-api

- Use Bulk API 2.0 to run a query that returns many rows, and return control to the terminal immediately:

  <%= config.bin %> <%= command.id %> --query "SELECT Id FROM Contact" --bulk --wait 0

# flags.queryToExecute

SOQL query to execute.

# flags.useToolingApi

Execute the query with Tooling API.

# flags.file

File that contains the SOQL query.

# flags.bulk

Use Bulk API 2.0 to run the query.

# flags.async

Use Bulk API 2.0, but don't wait for the job to complete.

# flags.wait

Time to wait for the command to finish, in minutes.

# flags.resultFormat

Format to display the results; the --json flag overrides this flag.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryNoResults

Your query returned no results.

# queryRunningMessage

Querying Data

# queryMoreUpdateMessage

Result size is %d, current count is %d

# queryInvalidReporter

Unknown result format type. Must be one of the following values: %s.

# bulkQueryTimeout

Query ID: %s
Query is in progress.

Run "<%= config.bin %> data query resume -i %s -o %s" to get the latest status and results.

# noResults

Your query returned no results.
