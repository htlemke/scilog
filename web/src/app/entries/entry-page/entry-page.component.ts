import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { LinkType, Paragraphs } from '@model/paragraphs';
import { Logbooks } from '@model/logbooks';
import { LogbookDataService, LogbookItemDataService } from '@shared/remote-data.service';
import { SnippetContentComponent } from '../../logbook/core/snippet/snippet-content/snippet-content.component';

/** One entry on a page of its own, opened from a link (`/entries/<id>`). */
@Component({
  selector: 'app-entry-page',
  templateUrl: './entry-page.component.html',
  styleUrls: ['./entry-page.component.css'],
  imports: [
    NgIf,
    NgFor,
    DatePipe,
    RouterLink,
    MatCard,
    MatCardContent,
    MatIcon,
    MatButton,
    SnippetContentComponent,
  ],
})
export class EntryPageComponent implements OnInit {
  state: 'loading' | 'ready' | 'missing' | 'failed' = 'loading';
  entry: Paragraphs | null = null;
  /** For a reply: the entry it quotes, as the reply keeps it. */
  quote: Paragraphs | null = null;
  comments: Paragraphs[] = [];
  /** The entry's logbook, if the reader may open it. */
  logbook: Logbooks | null = null;

  constructor(
    private route: ActivatedRoute,
    private entryData: LogbookItemDataService,
    private logbookData: LogbookDataService,
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    try {
      this.entry = (await this.entryData.getBasesnippet(id)) as Paragraphs;
    } catch (error) {
      // 403/404: unknown or not readable; anything else is a failure worth saying so
      this.state = [403, 404].includes(error?.status) ? 'missing' : 'failed';
      this.entry = null;
      return;
    }
    if (!this.entry || this.entry.snippetType !== 'paragraph' || this.entry.deleted) {
      this.entry = null;
      this.state = 'missing';
      return;
    }
    const children = ((this.entry.subsnippets ?? []) as Paragraphs[]).filter(
      (child) => child.snippetType === 'paragraph' && !child.deleted,
    );
    this.quote = children.find((child) => child.linkType === LinkType.QUOTE) ?? null;
    this.comments = children
      .filter((child) => child.linkType === LinkType.COMMENT)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    this.state = 'ready';
    if (this.entry.parentId) {
      try {
        this.logbook = await this.logbookData.getLogbookInfo(this.entry.parentId);
      } catch {
        this.logbook = null;
      }
    }
  }
}
