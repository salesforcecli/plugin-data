/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ux } from '@oclif/core';
import chalk from 'chalk';
import { get, getArray, isPlainObject, isString, Optional } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import { Field, FieldType, SoqlQueryResult } from '../dataSoqlQueryTypes.js';
import { QueryReporter, logFields, isSubquery, isAggregate, getAggregateAliasOrName } from './reporters.js';

type ParsedFields = {
  /** Field names */
  attributeNames: Array<Optional<string>>;
  /** For subqueries. Display the children under the parents */
  children: string[];
  /** For function fields, like avg(total). */
  aggregates: Field[];
};

export const nullString = chalk.bold('null');

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
export const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class HumanReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    logFields(this.logger)(this.data.query)(this.columns);
    const { attributeNames, children, aggregates } = parseFields(this.columns);
    // in case of count() there are no records, but there is a totalSize
    const totalCount = this.data.result.records.length ? this.data.result.records.length : this.data.result.totalSize;
    printTable(attributeNames, this.massageRows(this.data.result.records, children, aggregates), totalCount);
  }

  //  public massageRows(queryResults: BasicRecord[], children: string[], aggregates: Field[]): BasicRecord[] {
  public massageRows(
    queryResults: Array<Record<string, unknown>>,
    children: string[],
    aggregates: Field[]
  ): Array<Record<string, unknown>> {
    // some fields will return a JSON object that isn't accessible via the query (SELECT Metadata FROM RemoteProxy)
    // some will return a JSON that IS accessible via the query (SELECT owner.Profile.Name FROM Lead)
    // querying (SELECT Metadata.isActive FROM RemoteProxy) throws a SOQL validation error, so we have to display the entire Metadata object
    queryResults.forEach((qr) => {
      const result = qr;
      this.data.columns.forEach((col) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const entry = Reflect.get(result, col.name);
        if (typeof entry === 'object' && col.fieldType === FieldType.field) {
          Reflect.set(result, col.name, JSON.stringify(entry, null, 2));
        } else if (typeof entry === 'object' && col.fields?.length && entry) {
          col.fields.forEach((field) => {
            Reflect.set(result, `${col.name}.${field.name}`, get(result, `${col.name}.records[0].${field.name}`));
          });
        }
      });
    });

    // There are subqueries or aggregates. Massage the data.
    if (children.length > 0 || aggregates.length > 0) {
      const qr = queryResults.reduce<Array<Record<string, unknown>>>(
        (newResults: Array<Record<string, unknown>>, result) => {
          // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
          // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
          // and are returned in the data as the alias.
          if (aggregates.length > 0) {
            for (let i = 0; i < aggregates.length; i++) {
              const aggregate = aggregates[i];
              if (!aggregate.alias) {
                Reflect.set(result as never, aggregate.name, Reflect.get(result as never, `expr${i}`));
              }
            }
          }

          const subResults: Array<Record<string, unknown>> = [];
          if (children.length > 0) {
            const childrenRows: Record<string, unknown> = {};
            children.forEach((child) => {
              const aChild = get(result as never, child);
              Reflect.set(childrenRows, child, aChild);
              Reflect.deleteProperty(result as never, child);
            });

            Reflect.ownKeys(childrenRows).forEach((child) => {
              const childO = get(childrenRows, child as string);
              if (childO) {
                const childRecords = getArray(childO, 'records', []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                childRecords.forEach((record: unknown, index) => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  const newResult: Record<string, unknown> = {};
                  Object.entries(record as never).forEach(([key, value]) => {
                    if (!index) {
                      Reflect.defineProperty(result, `${child.toString()}.${key}`, {
                        value: value ?? nullString,
                      });
                    } else {
                      Reflect.defineProperty(newResult, `${child.toString()}.${key}`, {
                        value: value ?? nullString,
                      });
                    }
                  });
                  if (index) {
                    subResults.push(newResult);
                  }
                });
              }
            });
          }
          newResults.push(result, ...subResults);
          return newResults;
        },
        []
      );
      return qr;
    }
    return queryResults;
  }
}

export const parseFields = (fields: Field[]): ParsedFields => ({
  attributeNames: fields.flatMap(humanNamesFromField),
  children: fields.filter(isSubquery).map((field) => field.name),
  aggregates: fields.filter(isAggregate),
});

export const prepColumns = (columns: Array<Optional<string>>): ux.Table.table.Columns<Record<string, unknown>> => {
  const formattedColumns: ux.Table.table.Columns<Record<string, unknown>> = {};
  columns
    .map((field: Optional<string>) => field)
    .filter(isString)
    .map(
      (field) =>
        (formattedColumns[field] = {
          header: field.toUpperCase(),
          get: (row): string => {
            // first test if key exists, if so, return value
            if (Reflect.has(row, field)) {
              return (Reflect.get(row, field) as string) ?? '';
            } else {
              // if not, try to find it query
              return (get(row, field) as string) ?? '';
            }
          },
        })
    );
  return formattedColumns;
};

/** find null/undefined and replace it with a styled string */
export const prepNullValues = <T>(record: T): T =>
  isPlainObject(record)
    ? (Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, maybeReplaceNulls(maybeRecurseNestedObjects(value))])
      ) as T)
    : record;

const maybeReplaceNulls = <T>(value: T): T | string => value ?? nullString;
const maybeRecurseNestedObjects = <T>(value: T): T => (isPlainObject(value) ? prepNullValues(value) : value);

const printTable = (
  columns: Array<Optional<string>>,
  records: Array<Record<string, unknown>>,
  totalCount: number
): void => {
  ux.table(records.map(prepNullValues), prepColumns(columns));
  ux.log(chalk.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
};

const humanNamesFromField = (field: Field): string[] =>
  isSubquery(field)
    ? (field.fields ?? [])?.map((subfield) => `${field.name}.${subfield.name}`)
    : [getAggregateAliasOrName(field)];
