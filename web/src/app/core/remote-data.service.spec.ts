import { TestBed } from '@angular/core/testing';

import { RemoteDataService } from '@shared/remote-data.service';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppConfigService } from '../app-config.service';
import {
  EVERYONE_LOGGED_IN,
  LogbookDataService,
  LogbookItemDataService,
  SearchDataService,
} from './remote-data.service';
import { of } from 'rxjs';
import { WidgetItemConfig } from './model/config';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

const getConfig = () => ({});

describe('RemoteDataService', () => {
  let service: RemoteDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: AppConfigService, useValue: { getConfig } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RemoteDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should test staticFilters', () => {
    expect(service['staticFilters']()).toEqual([
      { snippetType: { inq: ['paragraph', 'image'] } },
      { deleted: false },
    ]);
  });

  it('should test addIncludeScope', () => {
    expect(service['addIncludeScope']()).toEqual({
      scope: {
        include: [
          {
            relation: 'subsnippets',
            scope: {
              where: { snippetType: 'edit' },
            },
          },
        ],
      },
    });
  });

  it('should test tagsFilter', () => {
    expect(service['tagsFilter']({ tags: ['a', 'b'], excludeTags: ['c', 'd'] })).toEqual([
      { tags: { inq: ['a', 'b'] } },
      { tags: { nin: ['c', 'd'] } },
    ]);
  });

  it('should test parentFilter', () => {
    expect(
      service['parentFilter']({ targetId: 'target', additionalLogbooks: ['add1', 'add2'] }),
    ).toEqual([{ parentId: { inq: ['target', 'add1', 'add2'] } }]);
  });
});

describe('LogbookItemDataService', () => {
  let service: LogbookItemDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: AppConfigService, useValue: { getConfig } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LogbookItemDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should include paragraph filter', () => {
    let config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: [],
        tags: [],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    let filter = service['_prepareFilters'](config);
    expect(filter['where']).toEqual({
      and: [
        { snippetType: { inq: ['paragraph', 'image'] } },
        { deleted: false },
        { parentId: { inq: ['target'] } },
      ],
    });
  });

  it('should include paragraph targetIds and tags', () => {
    let config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: ['target2'],
        tags: ['a', 'b'],
        excludeTags: ['c', 'd'],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    let filter = service['_prepareFilters'](config);
    expect(filter['where']).toEqual({
      and: [
        { snippetType: { inq: ['paragraph', 'image'] } },
        { deleted: false },
        { tags: { inq: ['a', 'b'] } },
        { tags: { nin: ['c', 'd'] } },
        { parentId: { inq: ['target', 'target2'] } },
      ],
    });
    expect(filter['include']).toEqual([
      {
        relation: 'subsnippets',
        scope: {
          where: {
            or: [
              { snippetType: 'edit' },
              { and: [{ tags: { inq: ['a', 'b'] } }, { tags: { nin: ['c', 'd'] } }] },
            ],
          },
          include: [
            {
              relation: 'subsnippets',
              scope: {
                where: { snippetType: 'edit' },
              },
            },
          ],
        },
      },
    ]);
  });

  it('should include tag filter', () => {
    let config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: [],
        tags: ['includeTag1'],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    let filter = service['_prepareFilters'](config);
    expect(filter['where'].and[2]).toEqual({ tags: { inq: config.filter.tags } });
  });

  it('should include tag filter with multiple tags', () => {
    let config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: [],
        tags: ['includeTag1', 'includeTag2'],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    let filter = service['_prepareFilters'](config);
    expect(filter['where'].and[2]).toEqual({ tags: { inq: config.filter.tags } });
  });

  it('should include excludeTags filter', () => {
    let config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: [],
        tags: ['includeTag1'],
        excludeTags: ['excludeTag1'],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    let filter = service['_prepareFilters'](config);
    expect(filter['where'].and[3]).toEqual({ tags: { nin: config.filter.excludeTags } });
  });

  it('should include multiple excludeTags filter', () => {
    let config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: [],
        tags: ['includeTag1'],
        excludeTags: ['excludeTag1', 'excludeTag2'],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    let filter = service['_prepareFilters'](config);
    expect(filter['where'].and[2]).toEqual({ tags: { inq: config.filter.tags } });
    expect(filter['where'].and[3]).toEqual({ tags: { nin: config.filter.excludeTags } });
  });

  it('should delete all edit snippets', () => {
    const spyDeleteSnippet = spyOn<LogbookItemDataService, any>(
      service,
      'deleteSnippet',
    ).and.returnValue(of([]));
    service.deleteAllInProgressEditing('1');
    expect(spyDeleteSnippet.calls.mostRecent().args).toEqual(['edits/paragraphs-to-delete', '1']);
  });

  [
    {
      input: undefined,
      expected: {
        scope: {
          include: [{ relation: 'subsnippets', scope: { where: { snippetType: 'edit' } } }],
        },
      },
    },
    {
      input: { tags: ['a', 'b'], excludeTags: ['c', 'd'] },
      expected: {
        scope: {
          include: [{ relation: 'subsnippets', scope: { where: { snippetType: 'edit' } } }],
          where: {
            or: [
              { snippetType: 'edit' },
              { and: [{ tags: { inq: ['a', 'b'] } }, { tags: { nin: ['c', 'd'] } }] },
            ],
          },
        },
      },
    },
    {
      input: { tags: ['a', 'b'] },
      expected: {
        scope: {
          include: [{ relation: 'subsnippets', scope: { where: { snippetType: 'edit' } } }],
          where: { or: [{ snippetType: 'edit' }, { and: [{ tags: { inq: ['a', 'b'] } }] }] },
        },
      },
    },
    {
      input: { excludeTags: ['c', 'd'] },
      expected: {
        scope: {
          include: [{ relation: 'subsnippets', scope: { where: { snippetType: 'edit' } } }],
          where: { or: [{ snippetType: 'edit' }, { and: [{ tags: { nin: ['c', 'd'] } }] }] },
        },
      },
    },
  ].forEach((t, i) => {
    it(`should addIncludeScope ${i}`, () => {
      expect(service['addIncludeScope'](t.input)).toEqual(t.expected);
    });
  });
});

describe('LogbookDataService', () => {
  let service: LogbookDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: AppConfigService, useValue: { getConfig } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LogbookDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call getSnippet with id', () => {
    const spyGetSnippets = spyOn<LogbookDataService, any>(service, 'getSnippets').and.returnValue(
      of([]),
    );
    service.getLogbookInfo('1');
    expect(spyGetSnippets.calls.mostRecent().args[0]).toEqual('logbooks/1');
  });

  it('should call getSnippets with list of ids', () => {
    const spyGetSnippets = spyOn<LogbookDataService, any>(service, 'getSnippets').and.returnValue(
      of([]),
    );
    service.getLogbooksInfo(['1', '2', '3']);
    expect(spyGetSnippets.calls.mostRecent().args[1]['params'].toString()).toEqual(
      'filter=%7B%22where%22:%7B%22id%22:%7B%22inq%22:%5B%221%22,%222%22,%223%22%5D%7D%7D%7D',
    );
  });

  it('should test _prepareFilters', () => {
    const filters = service['_prepareFilters']({ general: {}, filter: {}, view: {} }, 10, 20);
    expect(filters).toEqual({
      order: ['defaultOrder DESC'],
      where: { and: [{ snippetType: 'logbook', deleted: false }] },
      limit: 20,
      skip: 10,
    });
  });

  it('should POST importELN as multipart with the location-id param', () => {
    const httpTestingController = TestBed.inject(HttpTestingController);
    const file = new File(['x'], 'archive.eln');

    service.importELN(file, 'loc1');

    const req = httpTestingController.expectOne(
      (r) => r.url === 'http://[::1]:3000/logbooks/import/eln',
    );
    expect(req.request.method).toEqual('POST');
    expect(req.request.params.get('location-id')).toEqual('loc1');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({ id: 'lb1' });
    httpTestingController.verify();
  });
});

describe('LogbookItemDataService.shareWithEveryone', () => {
  const base = 'http://[::1]:3000/';
  let service: LogbookItemDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AppConfigService, useValue: { getConfig } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LogbookItemDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // the next request, once the service has sent it
  async function next(method: string, path: string) {
    for (let i = 0; i < 20; i++) {
      const found = http.match((r) => r.method === method && r.url === base + path);
      if (found.length) return found[0];
      await new Promise((resolve) => setTimeout(resolve));
    }
    throw new Error(`no ${method} ${path}`);
  }

  const entry = {
    id: 'e1',
    snippetType: 'paragraph',
    readACL: ['p1'],
    files: [{ fileId: 'f1' }, { fileId: 'f1' }, { fileHash: 'no-id' }],
    subsnippets: [
      { id: 'c1', snippetType: 'paragraph', linkType: 'comment', readACL: ['p1'] },
      {
        id: 'c2',
        snippetType: 'paragraph',
        linkType: 'quote',
        readACL: ['p1', EVERYONE_LOGGED_IN],
      },
      { id: 'h1', snippetType: 'edit' },
    ],
  };

  it('shares the comments and files first and the entry last, each once', async () => {
    const done = service.shareWithEveryone('e1', true);
    (await next('GET', 'basesnippets/e1')).flush(entry);
    const comment = await next('PATCH', 'basesnippets/c1');
    expect(JSON.parse(comment.request.body)).toEqual({ readACL: ['p1', EVERYONE_LOGGED_IN] });
    comment.flush(null);
    // c2 is shared already, h1 is not an entry: neither is patched
    (await next('GET', 'filesnippet/f1')).flush({ id: 'f1', readACL: ['p1'] });
    const file = await next('PATCH', 'filesnippet/f1');
    expect(JSON.parse(file.request.body)).toEqual({ readACL: ['p1', EVERYONE_LOGGED_IN] });
    file.flush(null);
    const own = await next('PATCH', 'basesnippets/e1');
    expect(JSON.parse(own.request.body)).toEqual({ readACL: ['p1', EVERYONE_LOGGED_IN] });
    own.flush(null);
    expect(await done).toEqual(['p1', EVERYONE_LOGGED_IN]);
  });

  it('unshares the entry first, then its comments and files', async () => {
    const done = service.shareWithEveryone('e1', false);
    (await next('GET', 'basesnippets/e1')).flush({ ...entry, readACL: ['p1', EVERYONE_LOGGED_IN] });
    const own = await next('PATCH', 'basesnippets/e1');
    expect(JSON.parse(own.request.body)).toEqual({ readACL: ['p1'] });
    own.flush(null);
    const quote = await next('PATCH', 'basesnippets/c2');
    expect(JSON.parse(quote.request.body)).toEqual({ readACL: ['p1'] });
    quote.flush(null);
    (await next('GET', 'filesnippet/f1')).flush({ id: 'f1', readACL: ['p1', EVERYONE_LOGGED_IN] });
    const file = await next('PATCH', 'filesnippet/f1');
    expect(JSON.parse(file.request.body)).toEqual({ readACL: ['p1'] });
    file.flush(null);
    expect(await done).toEqual(['p1']);
  });

  it('leaves the entry as it was when a file may not be changed', async () => {
    const done = service.shareWithEveryone('e1', true);
    (await next('GET', 'basesnippets/e1')).flush(entry);
    (await next('PATCH', 'basesnippets/c1')).flush(null);
    (await next('GET', 'filesnippet/f1')).flush({ id: 'f1', readACL: ['p1'] });
    (await next('PATCH', 'filesnippet/f1')).flush(
      { error: 'no' },
      { status: 403, statusText: 'Forbidden' },
    );
    await expectAsync(done).toBeRejected();
    expect(http.match((r) => r.method === 'PATCH' && r.url === base + 'basesnippets/e1')).toEqual(
      [],
    );
  });
});

describe('SearchDataService', () => {
  let service: SearchDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: AppConfigService, useValue: { getConfig } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SearchDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should be created', () => {
    const config = {
      general: {
        type: 'logbook',
        title: 'Logbook view',
      },
      filter: {
        targetId: 'target',
        additionalLogbooks: ['target2'],
        tags: ['a', 'b'],
        excludeTags: ['c', 'd'],
      },
      view: {
        order: ['defaultOrder ASC'],
        hideMetadata: false,
        showSnippetHeader: false,
      },
    };
    const filter = service['_prepareFilters'](config);
    expect(filter['where']).toEqual({
      and: [
        { snippetType: { inq: ['paragraph', 'image'] } },
        { deleted: false },
        { tags: { inq: ['a', 'b'] } },
        { tags: { nin: ['c', 'd'] } },
        { parentId: { inq: ['target', 'target2'] } },
      ],
    });

    expect(filter['include']).toEqual([
      {
        relation: 'subsnippets',
      },
    ]);
  });

  it('should test addIncludeScope', () => {
    expect(service['addIncludeScope']()).toEqual({});
  });

  [
    ['#search', '%23search'],
    ['@search', '%40search'],
    ['search', 'search'],
  ].forEach((t) => {
    it(`should test getDataBuffer ${t[0]}`, () => {
      service.searchString = t[0];
      const getSnippetSpy = spyOn<any>(service, 'getSnippets').and.returnValue({
        toPromise: () => {},
      });
      spyOn<any>(service, '_prepareParams');
      service.getDataBuffer(0, 0, {} as WidgetItemConfig);
      expect(getSnippetSpy.calls.mostRecent().args[0]).toEqual(`basesnippets/search=${t[1]}`);
    });
  });
});
