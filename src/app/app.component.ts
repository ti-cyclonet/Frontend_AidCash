import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from "./shared/components/header/header.component";
import { HEADER_BACKGROUND_COLOR, HEADER_ICON_COLOR, NAME_APP_LONG, PRIMARY_ACTIVE_TEXT_COLOR, PRIMARY_BACKGROUND_COLOR, PRIMARY_TEXT_COLOR, SIDEBAR_BACKGROUND_COLOR } from './config/config';
import { FooterComponent } from "./shared/components/footer/footer.component";
import { SidebarComponent } from "./shared/components/sidebar/sidebar.component";
import LayoutComponent from "./shared/components/layout/layout.component";
import { LoginComponent } from './shared/components/login/login.component';
import { isPlatformBrowser } from '@angular/common';
import { OptionMenu } from './shared/model/option_menu';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, SidebarComponent, LayoutComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit{
  
  title = NAME_APP_LONG;
  
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.setPrimaryColors();
    }
  }

  setPrimaryColors() {
    document.documentElement.style.setProperty('--primary-text-color', PRIMARY_TEXT_COLOR);
    document.documentElement.style.setProperty('--primary-background-color', PRIMARY_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--primary-active-text-color', PRIMARY_ACTIVE_TEXT_COLOR);
    document.documentElement.style.setProperty('--sidebar-background-color', SIDEBAR_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--header-background-color', HEADER_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--header-icon-color', HEADER_ICON_COLOR);
  }
}
