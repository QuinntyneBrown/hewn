import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toFieldErrors } from '../problems/field-errors';
import { DirectionDefaults } from '../projects/models';

/** Settings every direction starts with. Anyone signed in reads them; an Owner saves them. */
export interface SettingsApi {
  getDirectionDefaults(): Observable<DirectionDefaults>;
  /** Errors with FieldErrorsProblem when a value is out of range, and 403 for a Viewer. */
  saveDirectionDefaults(defaults: DirectionDefaults): Observable<DirectionDefaults>;
}

export const SETTINGS_API = new InjectionToken<SettingsApi>('SettingsApi');

@Injectable()
export class HttpSettingsApi implements SettingsApi {
  private readonly http = inject(HttpClient);

  getDirectionDefaults(): Observable<DirectionDefaults> {
    return this.http.get<DirectionDefaults>('/api/settings/direction-defaults');
  }

  saveDirectionDefaults(defaults: DirectionDefaults): Observable<DirectionDefaults> {
    return this.http
      .put<DirectionDefaults>('/api/settings/direction-defaults', defaults)
      .pipe(catchError((error: unknown) => throwError(() => toFieldErrors(error) ?? error)));
  }
}
