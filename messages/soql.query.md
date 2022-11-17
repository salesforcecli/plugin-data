# summary

execute a SOQL query

# description

execute a SOQL query
When you execute this command in a project, it executes the query against the data in your default scratch org.

To get data on API performance metrics, specify both --perflog and --json.

# examples

- <%= config.bin %> <%= command.id %> -q "SELECT Id, Name, Account.Name FROM Contact"

- <%= config.bin %> <%= command.id %> -q "SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')"

- <%= config.bin %> <%= command.id %> -q "SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')" --perflog --json

- <%= config.bin %> <%= command.id %> -q "SELECT Name FROM ApexTrigger" -t

- <%= config.bin %> <%= command.id %> --soqlqueryfile query.txt

- <%= config.bin %> <%= command.id %> --soqlqueryfile query.txt -t

# flags.queryToExecute

SOQL query to execute

# flags.useToolingApi

execute query with Tooling API

# flags.file

A SOQL query stored in a file

# flags.bulk

use the bulk 2.0 API to query data

# flags.async

use bulk, but do not wait for job to complete

# flags.wait

wait time for command to finish in minutes

# flags.resultFormat

result format emitted to stdout; --json flag overrides this parameter

# flags.resultFormat.description

Format to use when displaying results. If you also specify the --json flag, --json overrides this parameter.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryNoResults

Your query returned no results.

# queryRunningMessage

Querying Data

# queryMoreUpdateMessage

Result size is %d, current count is %d

# queryInvalidReporter

Unknown result format type. Must be one of the following values: %s

# bulkQueryTimeout

Query ID: %s
Query is in progress.

Run <%= config.bin %> data resume -i %s -o %s to get the latest status/results

# noResults

Your query returned no results.
