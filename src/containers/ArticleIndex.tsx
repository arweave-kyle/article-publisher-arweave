import React from 'react';
import ApiService, { prefix } from '../services/ApiService'
import ArticleListCard from '../components/ArticleListCard';
import './ArticleIndex.css'
import CachingService from '../services/CachingService';
import LoadingComponent from '../components/LoadingComponent';

type State = {
	articles: any[] | null
}

class ArticleIndex extends React.Component {

	api: ApiService
	cache: CachingService
	articles: any[]
	prefix: string
	state: State

	constructor(props: any) {
		super(props)

		this.api = new ApiService
		this.cache = new CachingService
		this.prefix = prefix

		this.state = {
			articles: null
		}

	}

	componentDidMount() {
		this.getArticles()
	}

	async getArticles() {
		console.log('getting articles....')
		const cachedArticles = this.cache.getDocument('index')
		console.log('cached articles', cachedArticles)
		if (cachedArticles) {
			this.setState({ articles: cachedArticles })
		} else {
			console.log('else fired')
			this.api.getAllArticles().then((articles: any) => {
				if (articles.tx_status && articles.tx.status.status !== 200) {
					throw (articles.tx_status.status)
				}
				console.log(articles)
				this.setState({ articles })
				this.cache.setDocument('index', articles)
			}).catch((err: any) => {
				this.setState({ articles: err })
			})
		}
	}

	render() {
		const { articles } = this.state
		return (
			articles ?
				articles.map((article: any) => {
					return (
						<div
							key={article.id}
							className='list-card'>
							<ArticleListCard
								article={article}
							/>
						</div>
					)
				}) : <LoadingComponent message={'Loading Articles......'} />
		)
	}
}
export default ArticleIndex

