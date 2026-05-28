import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgStyle } from '@angular/common';
import { OptionMenu } from '../../model/option_menu';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NgStyle],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  @Input() optionsMenu: OptionMenu[] = [];
  @Output() sidebarToggle = new EventEmitter<void>();
  private openSubmenuId: string | null = null;

  ngOnInit(): void {
    this.optionsMenu.sort((a, b) => parseInt(a.order, 10) - parseInt(b.order, 10));
  }

  getSubmenus(id: string): OptionMenu[] {
    return this.optionsMenu
      .filter(option => option.idMPather === id)
      .sort((a, b) => parseInt(a.order, 10) - parseInt(b.order, 10));
  }

  toggleSubmenu(id: string) {
    this.openSubmenuId = this.openSubmenuId === id ? null : id;
  }

  isSubmenuOpen(id: string): boolean {
    return this.openSubmenuId === id;
  }

  onToggleSidebar(): void {
    this.sidebarToggle.emit();
  }

  hasSubmenu(optionId: string): boolean {
    const submenus = this.getSubmenus(optionId);
    return submenus && submenus.length > 0;
  }
}
