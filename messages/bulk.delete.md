# summary

bulk delete records from a csv file

# description

bulk delete records from a csv file
The file must be a CSV file with only one column: "Id".
One job can contain many batches, depending on the length of the CSV file.
Returns a job ID and a batch ID. Use these IDs to check job status with data:resume.

# examples

- <%= config.bin %> <%= command.id %> -s Account -f ./path/to/file.csv

- <%= config.bin %> <%= command.id %> -s MyObject\_\_c -f ./path/to/file.csv

# flags.sobjecttype

the sObject type of the records you’re deleting

# flags.csvfile

the path to the CSV file containing the ids of the records to delete

# flags.wait

the number of minutes to wait for the command to complete before displaying the results
