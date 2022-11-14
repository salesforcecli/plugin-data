# summary

creates and inserts a record

# description

creates and inserts a record
The format of a field-value pair is <fieldName>=<value>.
Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
Enclose values that contain spaces in single quotes.

To get data on API performance metrics, specify both --perflog and --json.

# sObjectType

the type of the record you’re creating

# values

the <fieldName>=<value> pairs you’re creating

# useToolingApi

create the record with tooling api

# targetusername

username or alias for the target org; overrides default target org

# examples

- $ sfdx force:data:record:create -s Account -v "Name=Acme"

- $ sfdx force:data:record:create -s Account -v "Name='Universal Containers'"

- $ sfdx force:data:record:create -s Account -v "Name='Universal Containers' Website=www.example.com"

- $ sfdx force:data:record:create -t -s TraceFlag -v "DebugLevelId=7dl170000008U36AAE StartDate=2017-12-01T00:26:04.000+0000 ExpirationDate=2017-12-01T00:56:04.000+0000 LogType=CLASS_TRACING TracedEntityId=01p17000000R6bLAAS"

- $ sfdx force:data:record:create -s Account -v "Name=Acme" --perflog --json

# createSuccess

Successfully created record: %s.

# createFailure

Failed to create record. %s
