# summary

creates and inserts a record

# description

creates and inserts a record
The format of a field-value pair is <fieldName>=<value>.
Enclose all field-value pairs in one set of double quotation marks, delimited by spaces.
Enclose values that contain spaces in single quotes.

# flags.sobject

the type of the record you’re creating

# flags.values

the <fieldName>=<value> pairs you’re creating

# flags.useToolingApi

create the record with tooling api

# examples

- <%= config.bin %> <%= command.id %> -s Account -v "Name=Acme"

- <%= config.bin %> <%= command.id %> -s Account -v "Name='Universal Containers'"

- <%= config.bin %> <%= command.id %> -s Account -v "Name='Universal Containers' Website=www.example.com"

- <%= config.bin %> <%= command.id %> -t -s TraceFlag -v "DebugLevelId=7dl170000008U36AAE StartDate=2017-12-01T00:26:04.000+0000 ExpirationDate=2017-12-01T00:56:04.000+0000 LogType=CLASS_TRACING TracedEntityId=01p17000000R6bLAAS"

- <%= config.bin %> <%= command.id %> -s Account -v "Name=Acme" --perflog --json

# createSuccess

Successfully created record: %s.

# createFailure

Failed to create record. %s