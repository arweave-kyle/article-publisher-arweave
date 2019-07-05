import Arweave from 'arweave/web'
import { IArticle, IArticleContent } from '../types/types';
import sanitize from '../utils/sanitizeHtml';
import { query as arqlQuery} from '../utils/arql';
import { Tag } from 'arweave/web/lib/transaction';
import CachingService from '../services/CachingService';

const arweave = Arweave.init(
	{ host: 'arweave.net', port: 443, protocol: 'https' });

const envDevPrefix = 'scribe-alpha-dev-00'
const envProdPrefix = 'scribe-alpha-00'

const prefix = envProdPrefix;

export default class ApiService {

	cache = new CachingService;

	public createSynopsis(body: string) {
		let position = body.indexOf('.', 100)
		let str = `${body.slice(0, position)}...`
		return str
	}

	public async postArticle(article: IArticle, wallet: any, awv: any = arweave) {
		let tx = await awv.createTransaction({
			data: encodeURI(JSON.stringify(article.content))
		}, wallet)
		this.addAppMetaTags(tx, article)
		this.addContentTags(tx, article.meta.tags)
		try {
			await awv.transactions.sign(tx, wallet)
			const post = await awv.transactions.post(tx)
			if (post && post.status !== 200) {
				throw (post.status)
			}
		} catch (err) {
			return { err }
		}
	}

	public async getAllArticleIds(awv: any = arweave):Promise<string[]> {
		// We cache this result set to keep pagination stable
		const cacheKey = `index`;
		const cached = this.cache.getDocument(cacheKey);
		if (cached) {
			return cached;
		}

		const query = {
			op: 'equals',
			expr1: 'App-Name',
			expr2: prefix
		}

		const response = await awv.api.post(`arql`, query);

		if (response.data) {
			this.cache.setDocument(cacheKey, response.data);
			return response.data;
		}

		return [];
	}

	public async getAllTaggedArticleIds(tag: string, awv: any = arweave):Promise<string[]> {
		// We cache this result set to keep pagination stable

		const cacheKey = `tag-${tag}`;
		const cached = this.cache.getDocument(cacheKey);

		if (cached) {
			return cached;
		}

		let query =
		{
			op: 'and',
			expr1: {
				op: 'equals',
				expr1: 'App-Name',
				expr2: prefix
			},
			expr2: arqlQuery({
				[prefix + '-tag']: tag,
				[prefix + '-tag-0']: tag,
				[prefix + '-tag-1']: tag,
				[prefix + '-tag-2']: tag,
				[prefix + '-tag-3']: tag,
				[prefix + '-tag-4']: tag,
				[prefix + '-tag-5']: tag,
			},'or')
		}

		const response = await awv.api.post(`arql`, query); 
		if (response.data) {
			this.cache.setDocument(cacheKey, response.data);
			return response.data;
		}
		return [];

	}

	public async getAllArticles(offset: number, limit: number, awv: any = arweave) {
		try {
			const ids = await this.getAllArticleIds();
			return this.createRows(ids.slice(offset, limit + offset))
		}
		catch (err) {
			return { err }
		}
	}

	public async getArticlesByTag(tag: string, offset: number, limit: number, awv: any = arweave) {

		try {
			const ids = await this.getAllTaggedArticleIds(tag);
			return this.createRows(ids.slice(offset, limit + offset))
		}
		catch (err) {
			return { err }
		}
	}

	public async getArticleData(id: string, awv: any = arweave): Promise<IArticleContent> {
		const tx = await awv.transactions.get(id)
		const data = JSON.parse(
			decodeURI(
				tx.get('data', { decode: true, string: true })
			)
		) as {
			title: string,
			body: string,
			stringBody: string,
			tagline: string
		};
		
		const contentTagRegex = new RegExp(`^${envProdPrefix}-tag-[0-9]$`, 'i');

		const tags: string[] = [];

		tx.get('tags').forEach((tag: any) => {
			let key = tag.get('name', { decode: true, string: true }) as string;
			let value: string = tag.get('value', { decode: true, string: true })
			
			if (contentTagRegex.test(key)) {
				tags.push(value);
			}
		});

		data.body = sanitize(data.body)

		return {
			...data,
			tags: tags
		};
	}

	private async createRows(
		ids: string[],
		getData: boolean = false,
		awv: any = arweave,
	): Promise<any> {
		let tx_rows: any[] = []

		tx_rows = await Promise.all(
			ids.map(async (id: string) => {

				let tx_row: any = {}
				let tx = await awv.transactions.get(id);
				tx_row['unixTime'] = '0'
				const tags = tx.get('tags')
				if (tags.length) {
					tx_row.tags = []
					tx_row.scribe_data = []
					tx_row.scribe_tags = []
					tags.forEach((tag: Tag) => {
						let key = tag.get('name', { decode: true, string: true })
						let value: string = tag.get('value', { decode: true, string: true })
						if (
							key === `${prefix}-synopsis` ||
							key === `${prefix}-title` ||
							key === `${prefix}-tagline` ||
							key === `${prefix}-id`) {
							value = decodeURI(value)
							tx_row.scribe_data.push({ key, value })
							return
						} else if (key.indexOf(prefix) > -1) {
							tx_row.scribe_tags.push({ key, value })
						} else {
							tx_row[key] = { key, value }
						}
						if (key === 'Unix-Time') tx_row['unixTime'] = value
					})
				}

				tx_row['id'] = id

				// tx_row['tx_status'] = await awv.transactions.getStatus(id)
				
				tx_row['from'] = await awv.wallets.ownerToAddress(tx.owner)
				tx_row['td_fee'] = awv.ar.winstonToAr(tx.reward)
				tx_row['td_qty'] = awv.ar.winstonToAr(tx.quantity)

				if (getData) {
					tx_row['data'] = await tx.get('data', { decode: true, string: true })
				}

				return tx_row
			}))

		return tx_rows
	}

	private addAppMetaTags(tx: any, article: IArticle) {
		tx.addTag(`${prefix}-synopsis`, encodeURI(this.createSynopsis(article.content.stringBody)))
		tx.addTag('App-Name', `${prefix}`)
		tx.addTag(`${prefix}-id`, this.randomString())
		tx.addTag(`${prefix}-title`, encodeURI(article.content.title))
		tx.addTag(`${prefix}-tagline`, encodeURI(article.content.tagline))
		tx.addTag('App-Version', '0.0.1')
		tx.addTag(`${prefix}-entity`, 'article')
		tx.addTag('Unix-Time', this.getTime())
		return tx
	}

	private addContentTags(tx: any, tags: string[]) {
		tags.forEach((tag: string, index: number) => {
			tx.addTag(`${prefix}-tag`, tag)
		})
		return tx
	}

	public checkStatus(awv: any = arweave) {
		awv.network.getInfo().then(console.log)
	}

	private getTime(): number {
		return Math.round((new Date()).getTime() / 1000)
	}

	private randomString() {
		const chars = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		var result = '';
		for (var i = 32; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
		return result;
	}
}

export { prefix }