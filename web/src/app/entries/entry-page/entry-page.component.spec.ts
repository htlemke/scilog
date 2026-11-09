import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { EntryPageComponent } from './entry-page.component';
import { LogbookDataService, LogbookItemDataService } from '@shared/remote-data.service';
import { AppConfigService } from 'src/app/app-config.service';

describe('EntryPageComponent', () => {
  let fixture: ComponentFixture<EntryPageComponent>;
  let component: EntryPageComponent;
  let entryData: jasmine.SpyObj<LogbookItemDataService>;
  let logbookData: jasmine.SpyObj<LogbookDataService>;

  const entry = {
    id: '6061c0283587f37b851694c8',
    snippetType: 'paragraph',
    parentId: '602d4338daa91a637da213c4',
    createdAt: '2026-11-09T10:00:00.000Z',
    createdBy: 'someone@psi.ch',
    tags: ['alignment'],
    textcontent: '<p>The beam is back.</p>',
    files: [],
  };

  async function create(id = entry.id) {
    await TestBed.configureTestingModule({
      imports: [EntryPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
        { provide: LogbookItemDataService, useValue: entryData },
        { provide: LogbookDataService, useValue: logbookData },
        { provide: AppConfigService, useValue: { getConfig: () => ({}) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EntryPageComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    entryData = jasmine.createSpyObj('LogbookItemDataService', ['getBasesnippet']);
    logbookData = jasmine.createSpyObj('LogbookDataService', ['getLogbookInfo']);
  });

  it('shows the entry named in the link, with a way into its logbook', async () => {
    entryData.getBasesnippet.and.resolveTo(entry);
    logbookData.getLogbookInfo.and.resolveTo({ id: entry.parentId, name: 'Beamline log' });
    const page = await create();
    expect(entryData.getBasesnippet).toHaveBeenCalledWith(entry.id);
    expect(component.state).toBe('ready');
    expect(page.textContent).toContain('someone@psi.ch');
    expect(page.textContent).toContain('alignment');
    expect(page.querySelector('app-snippet-content')).toBeTruthy();
    const link = page.querySelector('.entry-page-context a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Beamline log');
    expect(link.getAttribute('href')).toBe(`/logbooks/${entry.parentId}/dashboard`);
  });

  it('says so when the entry can be read but its logbook cannot', async () => {
    entryData.getBasesnippet.and.resolveTo(entry);
    logbookData.getLogbookInfo.and.rejectWith({ status: 404 });
    const page = await create();
    expect(component.state).toBe('ready');
    expect(component.logbook).toBeNull();
    expect(page.querySelector('.entry-page-context a')).toBeNull();
    expect(page.textContent).toContain('not the logbook it belongs to');
  });

  it('says the entry is missing when it cannot be read', async () => {
    entryData.getBasesnippet.and.rejectWith({ status: 404 });
    const page = await create();
    expect(component.state).toBe('missing');
    expect(page.querySelector('.entry-page-missing')).toBeTruthy();
    expect(logbookData.getLogbookInfo).not.toHaveBeenCalled();
  });

  it('does not show what is not an entry, nor a deleted one', async () => {
    entryData.getBasesnippet.and.resolveTo({ ...entry, snippetType: 'logbook' });
    await create();
    expect(component.state).toBe('missing');

    TestBed.resetTestingModule();
    entryData.getBasesnippet.and.resolveTo({ ...entry, deleted: true });
    await create();
    expect(component.state).toBe('missing');
  });

  it('shows the comments below the entry and, for a reply, what it answers', async () => {
    const child = (id: string, linkType: string, createdAt: string, extra = {}) => ({
      id,
      snippetType: 'paragraph',
      linkType,
      parentId: entry.id,
      createdAt,
      createdBy: 'other@psi.ch',
      textcontent: `<p>${id}</p>`,
      files: [],
      ...extra,
    });
    entryData.getBasesnippet.and.resolveTo({
      ...entry,
      subsnippets: [
        child('second', 'comment', '2026-11-09T12:00:00.000Z'),
        child('quoted', 'quote', '2026-11-09T09:00:00.000Z'),
        child('first', 'comment', '2026-11-09T11:00:00.000Z'),
        child('gone', 'comment', '2026-11-09T11:30:00.000Z', { deleted: true }),
        { ...child('history', 'paragraph', '2026-11-09T11:40:00.000Z'), snippetType: 'edit' },
      ],
    });
    logbookData.getLogbookInfo.and.resolveTo({ id: entry.parentId, name: 'Beamline log' });
    const page = await create();
    expect(component.quote?.id).toBe('quoted');
    expect(component.comments.map((c) => c.id)).toEqual(['first', 'second']);
    expect(page.querySelector('.entry-page-quote app-snippet-content')).toBeTruthy();
    expect(page.querySelectorAll('.entry-page-comment').length).toBe(2);
  });

  it('tells a failure apart from an entry that is not there', async () => {
    entryData.getBasesnippet.and.rejectWith({ status: 0 });
    const page = await create();
    expect(component.state).toBe('failed');
    expect(page.querySelector('.entry-page-failed')).toBeTruthy();
    expect(page.querySelector('.entry-page-missing')).toBeNull();
  });
});
