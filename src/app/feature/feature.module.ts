import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { HomeComponent } from './home/home.component';
import { RequestsComponent } from './requests/requests.component';
import { SetupComponent } from './setup/setup.component';
import { UsersComponent } from './users/users.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule,
    HomeComponent,
    RequestsComponent,
    SetupComponent,
    UsersComponent
  ]
})
export class FeatureModule { }
