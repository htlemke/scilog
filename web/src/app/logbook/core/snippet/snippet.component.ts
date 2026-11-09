import {
  Component,
  OnInit,
  Input,
  ElementRef,
  ViewChild,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  SimpleChange,
  SimpleChanges,
  AfterContentInit,
  AfterViewChecked,
  OnDestroy,
} from '@angular/core';
import { ChangeStreamNotification } from '../changestreamnotification.model';
import { MatDialogConfig, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AddContentComponent } from '../add-content/add-content.component';
import { Paragraphs, LinkType } from '@model/paragraphs';
import { BehaviorSubject, Subscription } from 'rxjs';
import { SnippetContentComponent } from './snippet-content/snippet-content.component';
import { UserPreferencesService } from '@shared/user-preferences.service';
import { SnippetDashboardNameComponent } from './snippet-dashboard-name/snippet-dashboard-name.component';
import { SnippetInfoComponent } from './snippet-info/snippet-info.component';
import { EVERYONE_LOGGED_IN, LogbookItemDataService } from '@shared/remote-data.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { WidgetItemConfig } from '@model/config';
import { Edits } from 'src/app/core/model/edits';
import { Basesnippets } from 'src/app/core/model/basesnippets';
import { IsAllowedService } from 'src/app/overview/is-allowed.service';
import { MatCard, MatCardContent } from '@angular/material/card';
import { NgClass, NgIf, NgFor, DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { NgxJdenticonModule } from 'ngx-jdenticon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIconButton } from '@angular/material/button';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-snippet',
  templateUrl: './snippet.component.html',
  styleUrls: ['./snippet.component.scss'],
  animations: [
    trigger('highlightSnippet', [
      state('default', style({ backgroundColor: 'var(--snippet-color)' })),
      state('highlight', style({ backgroundColor: '#efefef' })),
      transition('highlight => default', animate('2000ms ease-out')),
      transition('default => highlight', animate('200ms ease-in')),
    ]),
  ],
  providers: [IsAllowedService],
  imports: [
    MatCard,
    NgClass,
    NgIf,
    MatIcon,
    NgxJdenticonModule,
    MatTooltip,
    MatIconButton,
    MatMenuTrigger,
    MatMenu,
    MatMenuItem,
    MatCardContent,
    NgFor,
    SnippetContentComponent,
    DatePipe,
  ],
})
export class SnippetComponent implements OnInit, AfterContentInit, AfterViewChecked, OnDestroy {
  @Input()
  snippet: ChangeStreamNotification;

  @Input()
  updatedAt: string;

  @Input()
  index: number;

  @Input()
  indexOrdered: number;

  @Input()
  isLogbook: boolean = true;

  @Input()
  config: WidgetItemConfig = {
    general: {},
    filter: {},
    view: {},
  };

  @Input()
  showEditButtonsMenu: boolean = true;

  @Input()
  linkType: LinkType = LinkType.PARAGRAPH;

  @Output()
  selected = new EventEmitter<ChangeStreamNotification>();

  @Output()
  isLoading = new EventEmitter<boolean>();

  isSelected = false;
  highlightState = 'default';
  styleClass = 'snippet';
  isHighlighted = false;
  content: string;
  imageToShow: string | ArrayBuffer;
  showImage: boolean;

  timerId = null;
  _enableEdit = { update: false, delete: false };
  snippetIsAccessedByAnotherUser = false;
  avatarHash = 'anotherUser';

  enableComments = true;
  showEditButtons = true;
  showInfoButton = true;
  renderedHeight: number = 0;
  _hideMetadata: boolean = false;

  figures: any;
  subscriptions: Subscription[] = [];
  _timeoutMilliseconds = 300000;
  _editDialog: MatDialogRef<AddContentComponent, any>;

  @ViewChild('snippetContainer', { read: ElementRef }) snippetContainerRef: ElementRef;
  @ViewChild('snippetContent') snippetContentRef: SnippetContentComponent;

  _subsnippets: BehaviorSubject<Basesnippets[]>;

  constructor(
    public dialog: MatDialog,
    private logbookItemDataService: LogbookItemDataService,
    private userPreferences: UserPreferencesService,
    protected isActionAllowed: IsAllowedService,
    private snackBar: MatSnackBar,
  ) {}

  /** The address of this entry on a page of its own, for sharing it. */
  get entryLink(): string {
    return new URL(`entries/${this.snippet.id}`, document.baseURI).href;
  }

  /** Everyone logged in to SciLog may read this entry, not only the logbook's readers. */
  get sharedWithEveryone(): boolean {
    return (this.snippet?.readACL ?? []).includes(EVERYONE_LOGGED_IN);
  }

  /** Sharing changes who may read, which SciLog allows to whoever may edit the entry, at any age. */
  get canShare(): boolean {
    return this.isActionAllowed.isMemberOf('update');
  }

  async setSharing(share: boolean) {
    try {
      this.snippet.readACL = await this.logbookItemDataService.shareWithEveryone(
        this.snippet.id,
        share,
      );
    } catch {
      this.snackBar.open(`The entry could not be ${share ? 'shared' : 'unshared'}`, 'Dismiss', {
        duration: 6000,
      });
      return;
    }
    if (!share) {
      this.snackBar.open("Only the logbook's readers can read this entry again", 'Dismiss', {
        duration: 4000,
      });
      return;
    }
    let copied = true;
    try {
      await navigator.clipboard.writeText(this.entryLink);
    } catch {
      copied = false;
    }
    this.snackBar
      .open(
        `Everyone logged in to SciLog can read this entry now${copied ? '; link copied' : ''}`,
        'Undo',
        { duration: 8000 },
      )
      .onAction()
      .subscribe(() => this.setSharing(false));
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.entryLink);
      this.snackBar.open('Link to this entry copied', 'Dismiss', { duration: 3000 });
    } catch {
      this.snackBar.open(`The link could not be copied: ${this.entryLink}`, 'Dismiss', {
        duration: 10000,
      });
    }
  }

  ngOnInit(): void {
    if (this.snippet.isMessage) {
      this.enableComments = false;
      this.showEditButtons = false;
      console.log(this.snippet);
      console.log(this.userPreferences.userInfo.email);

      if (this.snippet.updatedBy != this.userPreferences.userInfo.email) {
        this.styleClass = 'messagesReply'; // just for testing
      } else {
        this.styleClass = 'messages';
      }
      this.avatarHash = this.snippet.updatedBy;
    }
    if (this.snippet.linkType == LinkType.COMMENT) {
      this.styleClass = 'snippetComment';
      this.enableComments = false;
    } else if (this.snippet.linkType == LinkType.QUOTE) {
      this.styleClass = 'snippetQuote';
      this.showEditButtonsMenu = false;
    }
    // console.log(this.snippet);

    if (!this.config.view.hideMetadata) {
      if (typeof this.snippet?.tags == 'undefined' || this.snippet.tags.length == 0) {
        this._hideMetadata = true;
      } else {
        this._hideMetadata = false;
      }
    } else {
      this._hideMetadata = true;
    }
    // enable edit for snippet
    this.isActionAllowed.snippet = this.snippet;
    this.enableEdit = true;
    this._subsnippets = new BehaviorSubject(this.snippet.subsnippets);
  }

  @Input()
  set subsnippets(subsnippets: Basesnippets[]) {
    this._subsnippets?.next(subsnippets ?? []);
  }

  get subsnippets() {
    return this._subsnippets.value;
  }

  ngAfterContentInit() {
    this._subsnippets.subscribe(() => {
      this.setLocked();
    });
  }

  public get enableEdit(): any {
    return this._enableEdit;
  }

  public set enableEdit(v: boolean) {
    this._enableEdit.update = this.isActionAllowed.canUpdate() && v;
    this._enableEdit.delete = this.isActionAllowed.canDelete() && v;
  }

  ngAfterViewChecked(): void {
    //Called after every check of the component's view. Applies to components only.
    //Add 'implements AfterViewChecked' to the class.
    if (this.snippetContainerRef.nativeElement.offsetHeight != this.renderedHeight) {
      this.renderedHeight = this.snippetContainerRef.nativeElement.offsetHeight;
    }
  }

  highlightSnippetBorder(): void {
    this.highlightState = 'highlight';
    setTimeout(() => {
      this.highlightState = 'default';
    }, 1000);
  }

  updateContent() {
    this.snippetContentRef.prepareContent();
    if (!this.config.view.hideMetadata) {
      if (typeof this.snippet?.tags == 'undefined' || this.snippet.tags.length == 0) {
        this._hideMetadata = true;
      } else {
        this._hideMetadata = false;
      }
    } else {
      this._hideMetadata = true;
    }
    // console.log(this.content)
  }

  updateHtmlContent(content: string) {
    this.content = content;
    // this.snippetContainerRef.nativeElement.
  }

  editSnippet() {
    console.log('edit snippet');
    console.log(this.snippet.id);
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;
    dialogConfig.data = {
      snippet: this.snippet,
      content: this.content,
      defaultTags: this.snippet.tags,
      config: this.config,
    };
    const dialogRef = this.dialog.open(AddContentComponent, dialogConfig);
    this._editDialog = dialogRef;
    this.subscriptions.push(
      dialogRef.afterClosed().subscribe((result) => {
        console.log(`Dialog result: ${result}`);
      }),
    );
  }

  selectSnippet($event) {
    // console.log($event);
    this.selected.emit(this.snippet);
    // this.isSelected = !this.isSelected;
  }

  deleteSnippet() {
    console.log('delete snippet');
    console.log(this.snippet.id);
    if (window.confirm('Are you sure you want to delete this item? This cannot be undone.')) {
      this.logbookItemDataService.deleteLogbookItem(this.snippet.id);
    }
  }

  lockEditUntilTimeout(updateBy: string, timeOut?: number) {
    this.avatarHash = updateBy;
    this.lockEdit();
    this.setEditTimeout(timeOut ?? this._timeoutMilliseconds);
    console.log(typeof this.timerId);
  }

  setEditTimeout(timeOut: number) {
    this.timerId = setTimeout(async () => {
      console.log('unlocking');
      await this.releaseLock();
      this._editDialog?.close();
    }, timeOut);
  }

  async releaseLock() {
    this.enableEdit = true;
    this.snippetIsAccessedByAnotherUser = false;
    await this.logbookItemDataService.deleteAllInProgressEditing(this.snippet.id);
  }

  lockEdit() {
    clearTimeout(this.timerId);
    console.log('locking');
    this.snippetIsAccessedByAnotherUser = true;
    this.enableEdit = false;
  }

  addComment() {
    console.log('adding a comment');
    console.log(this.snippet.id);
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;

    let parentId = this.snippet.id;
    if (this.linkType == LinkType.COMMENT) {
      parentId = this.snippet.parentId;
    }
    let snippet: Paragraphs = {
      parentId: parentId,
      linkType: LinkType.COMMENT,
    };
    dialogConfig.data = { snippet: snippet, defaultTags: this.snippet.tags, config: this.config };
    this.openAddContentComponent(dialogConfig);
  }

  setDashboardName() {
    console.log(this.snippet.id);
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;

    dialogConfig.data = this.snippet;
    const dialogRef = this.dialog.open(SnippetDashboardNameComponent, dialogConfig);
    // this.subscriptions.push(dialogRef.afterClosed().subscribe(result => {
    //   console.log(`Dialog result: ${result}`);
    // }));
  }

  async addCitation() {
    console.log('adding a citation');
    console.log(this.snippet.id);
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;

    let parentId = this.snippet.parentId;
    if (this.snippet.linkType == LinkType.COMMENT) {
      let parent_snippet = await this.logbookItemDataService.getBasesnippet(this.snippet.parentId);
      parentId = parent_snippet.parentId;
    }

    let snippet: Paragraphs = {
      parentId: parentId,
      linkType: LinkType.QUOTE,
      subsnippets: [this.snippet],
    };
    dialogConfig.data = { snippet: snippet, defaultTags: this.snippet.tags, config: this.config };
    this.openAddContentComponent(dialogConfig);
  }

  openAddContentComponent(dialogConfig: MatDialogConfig) {
    const dialogRef = this.dialog.open(AddContentComponent, dialogConfig);
    this.subscriptions.push(
      dialogRef.afterClosed().subscribe((result) => {
        console.log(`Dialog result: ${result}`);
      }),
    );
  }

  setElementLoading($event) {
    this.isLoading.emit($event);
  }

  showInfo() {
    console.log(this.snippet.id);
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;

    dialogConfig.data = this.snippet;
    const dialogRef = this.dialog.open(SnippetInfoComponent, dialogConfig);
  }

  getLastEditedSnippet(subSnippets: Edits[]) {
    let out: Edits;
    let maxCreatedAt = 0;
    for (let i = 0; i < subSnippets?.length; i++) {
      if (subSnippets[i].snippetType !== 'edit') continue;
      if (subSnippets[i].toDelete) {
        out = subSnippets[i];
        break;
      }
      const createdAt = Date.parse(subSnippets[i].createdAt);
      if (createdAt > maxCreatedAt) {
        maxCreatedAt = createdAt;
        out = subSnippets[i];
      }
    }
    return out;
  }

  setLocked() {
    const lastEdited = this.getLastEditedSnippet(this.subsnippets);
    if (!lastEdited) return;
    const timeFromLock = new Date().getTime() - Date.parse(lastEdited.createdAt);
    if (!lastEdited.toDelete && timeFromLock < this._timeoutMilliseconds) {
      this.lockEditUntilTimeout(lastEdited.updatedBy, this._timeoutMilliseconds - timeFromLock);
      return;
    }
    this.releaseLock();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
