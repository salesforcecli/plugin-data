# summary

bulk upsert records from a CSV file

# description

bulk upsert records from a CSV file
Inserts or updates records from a CSV file.

One job can contain many batches, depending on the length of the CSV file.
Returns a job ID and a batch ID. Use these IDs to check job status with data:resume.

For information about formatting your CSV file, see "Prepare CSV Files" in the Bulk API Developer Guide.

By default, the job runs the batches in parallel. Specify --serial to run them serially.

# examples

- <%= config.bin %> <%= command.id %> -s MyObject**c -f ./path/to/file.csv -i MyField**c

- <%= config.bin %> <%= command.id %> -s MyObject\_\_c -f ./path/to/file.csv -i Id -w 2

# flags.sobjecttype

the sObject type of the records you want to upsert

# flags.csvfile

the path to the CSV file that defines the records to upsert

# flags.externalid

the column name of the external ID

# flags.wait

the number of minutes to wait for the command to complete before displaying the results

# flags.serial

run batches in serial mode
