# summary

execute a SOQL query

# description

execute a SOQL query
When you execute this command in a project, it executes the query against the data in your default scratch org.

To get data on API performance metrics, specify both --perflog and --json.

# examples

- $ sfdx force:data:soql:query -q "SELECT Id, Name, Account.Name FROM Contact"

- $ sfdx force:data:soql:query -q "SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')"

- $ sfdx force:data:soql:query -q "SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')" --perflog --json

- $ sfdx force:data:soql:query -q "SELECT Name FROM ApexTrigger" -t

- $ sfdx force:data:soql:query --soqlqueryfile query.txt

- $ sfdx force:data:soql:query --soqlqueryfile query.txt -t

# flags.queryToExecute

SOQL query to execute

# flags.useToolingApi

execute query with Tooling API

# flags.file

A SOQL query stored in a file

# flags.async

use the bulk 2.0 API to query data

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

Run sfdx force:data:soql:bulk:report -i %s -u %s to get the latest status/results

# noResults

Your query returned no results.
