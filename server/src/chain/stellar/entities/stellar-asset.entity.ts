
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity()
export class StellarAsset {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 128 })
    contractId: string;

    @Column({ length: 128 })
    storyId: string;

    @Column({ length: 128 })
    code: string;

    @Column({ length: 128 })
    issuer: string;

    @Column({ length: 128 })
    name: string;

    @Column({ length: 1500 })
    description: string;

    @Column({ length: 128 })
    imageCID: string;

    @Column()
    price: string;

    @Column()
    total: number;

    @Column()
    authorReserved: number;

    @Column({ default: 0 })
    sold: number;

    @Column({ default: 0 })
    authorClaimed: number;

    @CreateDateColumn()
    createTime: Date;

    @UpdateDateColumn()
    updateTime: Date;

    @Column({ default: false })
    isPublished: boolean;
}