import React from 'react';
import ApiService from '../services/ApiService'
import ArticleListCard from '../components/ArticleListCard';
import './ArticleIndex.css'
import CachingService from '../services/CachingService';
import LoadingComponent from '../components/common/LoadingComponent';
import ErrorComponent from '../components/common/ErrorComonent';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { Button } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';

type State = {
	loading: boolean,
	page: number,
	perPage: number,
	list: any[],
	err: any
}

class ArticleIndex extends React.Component <RouteComponentProps<{tag?: string}>> {
	state: State
	api: ApiService
	cache: CachingService

	constructor(props: any) {
		super(props)

		this.api = new ApiService
		this.cache = new CachingService

		this.state = {
			loading: false,
			page: 0,
			perPage: 5,
			list: [],
			err: ''
		}
	}

	componentDidUpdate(prevProps: any) {
        if (this.props.location.pathname !== prevProps.location.pathname) {
            this.getArticles(this.props.match.params.tag);
        }
    }

	componentDidMount() {
		this.getArticles(this.props.match.params.tag || null, 0);
	}

	getArticles = async (tag: string|null, page: number = 0) => {
		this.setState({ loading: true });

		if (page == 0) {
			this.setState({ list: [] })
		}	
		
		(tag
			? this.api.getArticlesByTag(tag, (this.state.perPage * page), this.state.perPage)
			: this.api.getAllArticles((this.state.perPage * page), this.state.perPage)
		)
		.then((articles: any) => {
			this.setState({
				list: this.state.list.concat(articles),
				loading: false
			});
		}).catch((err: any) => {
			this.setState({ err , loading: false});
		})
	}

	loadMore = async () => {
		this.setState({page: this.state.page + 1}, () => {
			this.getArticles(this.props.match.params.tag || null, this.state.page);
		})
	}

	exploreTag = (tag: string) => {
		this.props.history.push(`/explore/${tag}`);
	};

	render() {
		const { list, err, loading } = this.state;

		return (
			list.length ?
				(<>
					{list.map((article: any) => {
						return (
							<div
								key={article.id}
								className='list-card'
							>
								<ArticleListCard
									article={article}
									onTagClick={this.exploreTag}
								/>
							</div>
						)
					})}
					<div className="load-more-container">

						{loading ? <CircularProgress color="inherit" />: 
						<Button
							variant="outlined"
							onClick={this.loadMore}
							style={{margin: '0 auto'}}
						>
							Load more
						</Button>}
					</div>
					</>
				)
				:
				err.message ?
					<ErrorComponent message={err.message}/>
					:
					<LoadingComponent message={'Loading Articles...'} />
		)
	}
}

export default withRouter(ArticleIndex)

