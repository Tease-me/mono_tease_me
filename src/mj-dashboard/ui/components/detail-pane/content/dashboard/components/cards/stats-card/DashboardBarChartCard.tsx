import React, { HTMLAttributes, useEffect, useRef, useState } from 'react';
import styles from "./DashboardBarChartCard.module.css"
import clsx from 'clsx';
import DashboardCard from '../DashboardCard';
import { Bar, BarChart, XAxis } from 'recharts';
import { EarningsData } from '@/mj-dashboard/data/models/DashboardResponse';

interface DashboardBarChartCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    title: string;
    data: EarningsData[];
}

const DashboardBarChartCard: React.FC<DashboardBarChartCardProps> = (({ title, data, ...props }) => {
    const [dimensions, setDimensions] = useState({ width: 100, height: 300 });
    const barchartCardRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function updateSize() {
            if (!barchartCardRef.current) return;
            const { width, height } = barchartCardRef.current.getBoundingClientRect();
            setDimensions({ width: width, height: height });
        }
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [barchartCardRef])

    return (
        <DashboardCard {...props} className={clsx(styles["dashboard-stats-card"], props.className)} >
            <div className={styles["title"]}>{title}</div>
            <div ref={barchartCardRef} className={styles["content"]}>
                <BarChart width={dimensions.width} height={dimensions.height} data={data}>
                    <XAxis dataKey="month" />
                    <Bar dataKey="earnings" barSize={dimensions.width * 0.05} fill="var(--color-primary)" />
                </BarChart>
            </div>
        </DashboardCard>
    );
});

export default DashboardBarChartCard;