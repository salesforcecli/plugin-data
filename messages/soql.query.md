# summary

execute a SOQL query

# description

execute a SOQL query
When you execute this command in a project, it executes the query against the data in your default scratch org.

To get data on API performance metrics, specify both --perflog and --json.

# noResults

Your query returned no results.

# queryToExecute

SOQL query to execute

# queryLongDescription

SOQL query to execute.

# queryToolingDescription

execute query with Tooling API

# queryInvalidReporter

Unknown result format type. Must be one of the following values: %s

# resultFormatDescription

result format emitted to stdout; --json flag overrides this parameter

# resultFormatLongDescription

Format to use when displaying results. If you also specify the --json flag, --json overrides this parameter.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryNoResults

Your query returned no results.

# queryRunningMessage

Querying Data

# queryMoreUpdateMessage

Result size is %d, current count is %d

# bulkDescription

use the bulk 2.0 API to query data

# waitDescription

wait time for command to finish in minutes

# bulkQueryTimeout

Query ID: %s
Query is in progress.

Run sfdx force:data:soql:bulk:report -i %s -u %s to get the latest status/results

# soqlqueryfile

A SOQL query stored in a file

# targetusername

username or alias for the target org; overrides default target org

# examples

- $ sfdx force:data:soql:query -q "SELECT Id, Name, Account.Name FROM Contact"

- $ sfdx force:data:soql:query -q "SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')"

- $ sfdx force:data:soql:query -q "SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')" --perflog --json

- $ sfdx force:data:soql:query -q "SELECT Name FROM ApexTrigger" -t

- $ sfdx force:data:soql:query --soqlqueryfile query.txt

- $ sfdx force:data:soql:query --soqlqueryfile query.txt -t