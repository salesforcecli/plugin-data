# flags.sobjecttype

API name of the Salesforce object, either standard or custom, that you want to delete records from.

# flags.csvfile

CSV file that contains the IDs of the records to delete.

# flags.wait

Number of minutes to wait for the command to complete before displaying the results.

# flags.async.summary

Run the command asynchronously.

# flags.async.description

Run the command asynchronously. The command returns immediately and displays the job ID. Use the job ID to check the status of the job with the "<%= config.bin %> data resume" command.

# success

Bulk %s request %s started successfully

# checkStatus

Run command %s data %s resume -i %s -o %s to check status.

# checkJobViaUi

To review the details of this job, run:
%s org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# remainingTimeStatus

Remaining time: %d minutes.

# remainingRecordsStatus

%d/%d/%d records successful/failed/processed.
