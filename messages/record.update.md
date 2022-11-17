# summary

updates a single record

# description

updates a single record
The format of a field-value pair is <fieldName>=<value>.
Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
Enclose values that contain spaces in single quotes.

To get data on API performance metrics, specify both --perflog and --json.

# flags.sobject

the sObject type of the record you’re updating

# flags.recordId

the ID of the record you’re updating

# flags.where

a list of <fieldName>=<value> pairs to search for

# flags.useToolingApi

update the record with Tooling API

# flags.values

the <fieldName>=<value> pairs you’re updating

# examples

- <%= config.bin %> <%= command.id %> -s Account -i 001D000000Kv3dl -v "Name=NewAcme"

- <%= config.bin %> <%= command.id %> -s Account -w "Name='Old Acme'" -v "Name='New Acme'"

- <%= config.bin %> <%= command.id %> -s Account -i 001D000000Kv3dl -v "Name='Acme III' Website=www.example.com"

- <%= config.bin %> <%= command.id %> -t -s TraceFlag -i 7tf170000009cUBAAY -v "ExpirationDate=2017-12-01T00:58:04.000+0000"

- <%= config.bin %> <%= command.id %> -s Account -i 001D000000Kv3dl -v "Name=NewAcme" --perflog --json

# updateSuccess

Successfully updated record: %s.

# updateFailure

Failed to update record. %s

# updateFailureWithFields

Failed to update record with code %s. Message: %s. Fields: %s.
