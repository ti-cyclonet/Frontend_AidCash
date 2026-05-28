import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    FooterComponent,
    RouterOutlet
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export default class LayoutComponent implements OnInit {
  optionsMenu: OptionMenu[] = [];
  isSidebarVisible = true;
  isLargeScreen = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    this.optionsMenu = [
      { id: '1', name: 'homeShotra', description: 'Home', url: '/home', icon: 'house-fill', type: 'main_menu', idMPather: null, order: '1', idApplication: '3' },
      { id: '2', name: 'usersShotra', description: 'Users', url: '/users', icon: 'people-fill', type: 'main_menu', idMPather: null, order: '2', idApplication: '1' },
      { id: '3', name: 'requestsShotra', description: 'Requests', url: '/requests', icon: 'file-text-fill', type: 'main_menu', idMPather: null, order: '3', idApplication: '3' },
      { id: '4', name: 'settingsShotra', description: 'Settings', url: '/setup', icon: 'gear-fill', type: 'main_menu', idMPather: null, order: '4', idApplication: '3' }
      //{ id: '5', name: 'usersShotraCreate', description: 'Add', url: '/users', icon: 'person-add', type: 'submenu_l1', idMPather: '2', order: '1', idApplication: '3' }
      //{ id: '6', name: 'usersShotraDelete', description: 'Delete', url: null, icon: 'person-dash', type: 'submenu_l1', idMPather: '2', order: '2', idApplication: '3' }
      //{ id: '7', name: 'requetsShotraCreate', description: 'Add', url: '/requests', icon: null, type: 'submenu_l1', idMPather: '3', order: '1', idApplication: '3' },
      //{ id: '8', name: 'requetsShotraList', description: 'List', url: null, icon: null, type: 'submenu_l1', idMPather: '3', order: '2', idApplication: '3' }
    ];
  }

  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }
}
