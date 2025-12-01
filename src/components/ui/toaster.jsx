import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast';
import { subscribeToToasts, getToastsState } from '@/hooks/use-toast';
import React from 'react';

export function Toaster() {
	return (
		<ToastProvider duration={4000}>
			<ToastList />
			<ToastViewport />
		</ToastProvider>
	);
}

class ToastList extends React.Component {
	constructor(props) {
		super(props);
		this.state = { toasts: getToastsState().toasts || [] };
	}
	componentDidMount() {
		this.unsubscribe = subscribeToToasts((state) => {
			this.setState({ toasts: state.toasts || [] });
		});
	}
	componentWillUnmount() {
		this.unsubscribe && this.unsubscribe();
	}
	render() {
		const { toasts } = this.state;
		return (
			<>
				{toasts.map(({ id, title, description, action, ...props }) => (
					<Toast key={id} {...props}>
						<div className="grid gap-1">
							{title && <ToastTitle>{title}</ToastTitle>}
							{description && (
								<ToastDescription>{description}</ToastDescription>
							)}
						</div>
						{action}
						<ToastClose />
					</Toast>
				))}
			</>
		);
	}
}