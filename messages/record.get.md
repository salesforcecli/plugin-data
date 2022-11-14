# summary

displays a single record

# description

displays a single record
Specify an sObject type and either an ID or a list of <fieldName>=<value> pairs.
The format of a field-value pair is <fieldName>=<value>.
Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
Enclose values that contain spaces in single quotes.

To get data on API performance metrics, specify both --perflog and --json.

# sObjectType

the type of the record you’re retrieving

# sObjectId

the ID of the record you’re retrieving

# where

a list of <fieldName>=<value> pairs to search for

# useToolingApi

retrieve the record with Tooling API

# targetusername

username or alias for the target org; overrides default target org

# examples

- $ sfdx force:data:record:get -s Account -i 001D000000Kv3dl

- $ sfdx force:data:record:get -s Account -w "Name=Acme"

- $ sfdx force:data:record:get -s Account -w "Name='Universal Containers'"

- $ sfdx force:data:record:get -s Account -w "Name='Universal Containers' Phone='(123) 456-7890'"

- $ sfdx force:data:record:get -t -s TraceFlag -i 7tf170000009cUBAAY --perflog --json
