/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Interface that can be implemented by classes meant to display information directly to the user
 * (for example, via {@code console.log()}).
 * The interface/implementation pattern allows for extremely easy mocking of dependencies in tests.
 */
export interface Display {
  displayWarning(msg: string): void;
}

export interface Displayable {
  warn(message: string): void;
}

export class UxDisplay implements Display {
  private readonly displayable: Displayable;

  public constructor(displayable: Displayable) {
    this.displayable = displayable;
  }

  public displayWarning(msg: string): void {
    this.displayable.warn(msg);
  }
}
